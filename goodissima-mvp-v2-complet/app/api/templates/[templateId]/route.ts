import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { templateId: string } }) {
  await getCurrentPrismaUser();
  const template = await prisma.formTemplate.findUnique({
    where: { id: params.templateId },
    include: { relationTemplate: { include: { _count: { select: { links: true, relationCases: true } } } } },
  });
  if (!template?.relationTemplate) return NextResponse.json({ error: "Brouillon introuvable." }, { status: 404 });
  if (template.relationTemplate.status !== "DRAFT") return NextResponse.json({ error: "Seul un brouillon non publié peut être supprimé." }, { status: 409 });
  if (template.relationTemplate._count.links > 0 || template.relationTemplate._count.relationCases > 0) return NextResponse.json({ error: "Ce brouillon est déjà utilisé et ne peut pas être supprimé." }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.formTemplate.delete({ where: { id: template.id } });
    await tx.relationTemplate.delete({ where: { id: template.relationTemplate!.id } });
  });
  return NextResponse.json({ ok: true });
}
