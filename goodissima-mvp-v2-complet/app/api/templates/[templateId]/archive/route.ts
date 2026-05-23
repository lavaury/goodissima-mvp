import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  await getCurrentPrismaUser();

  const body = await req.json().catch(() => ({}));
  const confirm = Boolean(body.confirm);
  const template = await prisma.formTemplate.findUnique({
    where: { id: params.templateId },
    include: { relationTemplate: true },
  });

  if (!template?.relationTemplate) {
    return NextResponse.json({ error: "parcours introuvable" }, { status: 404 });
  }

  const activeLinks = await prisma.gLink.count({
    where: {
      status: "ACTIVE",
      OR: [
        { templateId: template.relationTemplate.id },
        { templateVersion: { templateId: template.relationTemplate.id } },
      ],
    },
  });

  if (activeLinks > 0 && !confirm) {
    return NextResponse.json(
      {
        error: `${activeLinks} lien(s) actif(s) utilisent encore ce parcours publié. Confirmez pour archiver quand même.`,
        activeLinks,
      },
      { status: 409 },
    );
  }

  await prisma.relationTemplate.update({
    where: { id: template.relationTemplate.id },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ ok: true, activeLinks });
}
