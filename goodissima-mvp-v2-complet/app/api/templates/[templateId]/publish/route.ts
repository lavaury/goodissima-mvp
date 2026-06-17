import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { checkCandidatePublicationSafety, toCandidateFormField } from "@/lib/candidate-form-safety";
import { buildTemplateSnapshot } from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { templateId: string } }) {
  await getCurrentPrismaUser();

  const snapshot = await buildTemplateSnapshot(params.templateId);

  if (!snapshot) {
    return NextResponse.json({ error: "Parcours introuvable ou incomplet" }, { status: 404 });
  }

  const candidateFormSafety = checkCandidatePublicationSafety(
    snapshot.fields.map((field) => toCandidateFormField(field)),
  );

  if (!candidateFormSafety.publishable) {
    return NextResponse.json(
      {
        error: candidateFormSafety.error,
        code: "CANDIDATE_FORM_SAFETY_BLOCKED",
        candidateFormSafety,
      },
      { status: 400 },
    );
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

  revalidatePath(`/templates/${params.templateId}`);
  revalidatePath("/templates");
  revalidatePath("/opportunities");

  return NextResponse.json({
    publishedObject: "ANNOUNCEMENT",
    status: "PUBLISHED",
    publishedAt: templateVersion.createdAt.toISOString(),
    version: templateVersion.version,
    templateVersionId: templateVersion.id,
    journeyTemplateId: snapshot.relationTemplate.id,
  });
}
