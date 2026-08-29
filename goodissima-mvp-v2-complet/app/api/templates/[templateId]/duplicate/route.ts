import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizedFormTemplateWhere, resolveTemplateWorkspaceDestination } from "@/lib/template-authorization";

function copyKey(baseKey: string) {
  return `${baseKey}_COPY_${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 80);
}

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  const owner = await getCurrentPrismaUser();

  const template = await prisma.formTemplate.findFirst({
    where: authorizedFormTemplateWhere(params.templateId, owner.id),
    include: {
      relationTemplate: { include: { workspace: { select: { id: true, status: true } } } },
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!template?.relationTemplate) {
    return NextResponse.json({ error: "parcours introuvable" }, { status: 404 });
  }

  let destinationWorkspaceId: string;
  if (template.relationTemplate.workspace) {
    if (template.relationTemplate.workspace.status !== "ACTIVE") {
      return NextResponse.json({ error: "Ce parcours appartient à un espace de travail non actif et ne peut pas être dupliqué." }, { status: 409 });
    }
    destinationWorkspaceId = template.relationTemplate.workspace.id;
  } else {
    const body = await req.json().catch(() => ({}));
    const destination = await resolveTemplateWorkspaceDestination(
      owner.id,
      typeof body.workspaceId === "string" ? body.workspaceId : null,
    );
    if (destination.kind === "ZERO") return NextResponse.json({ error: "Un espace de travail actif est nécessaire pour dupliquer ce parcours." }, { status: 409 });
    if (destination.kind === "MULTIPLE") return NextResponse.json({ error: "Choisissez un espace de travail pour dupliquer ce parcours.", code: "WORKSPACE_SELECTION_REQUIRED" }, { status: 409 });
    if (destination.kind === "INVALID_SELECTION") return NextResponse.json({ error: "Espace de travail introuvable." }, { status: 404 });
    destinationWorkspaceId = destination.workspace.id;
  }

  const sourceRelationTemplate = template.relationTemplate;
  const relationKey = copyKey(sourceRelationTemplate.key);
  const formKey = `${relationKey}_FORM`;
  const created = await prisma.$transaction(async (tx) => {
    const relationTemplate = await tx.relationTemplate.create({
      data: {
        workspaceId: destinationWorkspaceId,
        key: relationKey,
        name: `${sourceRelationTemplate.name} - copie`,
        description: sourceRelationTemplate.description,
        status: "DRAFT",
      },
    });

    const formTemplate = await tx.formTemplate.create({
      data: {
        key: formKey,
        name: `${template.name} - copie`,
        description: template.description,
        relationTemplateId: relationTemplate.id,
      },
    });

    if (template.fields.length > 0) {
      await tx.formField.createMany({
        data: template.fields.map((field) => ({
          formTemplateId: formTemplate.id,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder,
          defaultValue: field.defaultValue,
          position: field.position,
          step: field.step,
          options: field.options === null ? Prisma.JsonNull : field.options,
          validationRules: field.validationRules === null ? Prisma.JsonNull : field.validationRules,
          conditionalRules: field.conditionalRules === null ? Prisma.JsonNull : field.conditionalRules,
        })),
      });
    }

    return formTemplate;
  });

  return NextResponse.json(created, { status: 201 });
}
