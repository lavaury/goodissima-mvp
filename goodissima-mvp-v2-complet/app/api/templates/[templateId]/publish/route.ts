import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { buildTemplateSnapshot } from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { templateId: string } }) {
  await getCurrentPrismaUser();

  const snapshot = await buildTemplateSnapshot(params.templateId);

  if (!snapshot) {
    return NextResponse.json({ error: "Parcours introuvable ou incomplet" }, { status: 404 });
  }

  const lastVersion = await prisma.templateVersion.findFirst({
    where: { templateId: snapshot.relationTemplate.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const templateVersion = await prisma.$transaction(async (tx) => {
    await tx.templateVersion.updateMany({
      where: { templateId: snapshot.relationTemplate.id, isPublished: true },
      data: { isPublished: false },
    });

    const created = await tx.templateVersion.create({
      data: {
        templateId: snapshot.relationTemplate.id,
        version,
        name: snapshot.relationTemplate.name,
        description: snapshot.relationTemplate.description,
        snapshot,
        isPublished: true,
      },
    });

    await tx.relationTemplate.update({
      where: { id: snapshot.relationTemplate.id },
      data: { status: "PUBLISHED" },
    });

    return created;
  });

  return NextResponse.json(templateVersion);
}
