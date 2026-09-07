import { getTemplateMutationAccess, templateMutationNotFound } from "@/lib/template-mutation-access";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function copyKey(baseKey: string) {
  return `${baseKey}_COPY_${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 80);
}

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  const owner = await getCurrentPrismaUser();
  const access = await getTemplateMutationAccess(owner, params.templateId);
  if (!access) return templateMutationNotFound();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || !("workspaceId" in body)) {
    return NextResponse.json({ error: "Un Workspace cible explicite est requis pour attribuer la copie.", code: "WORKSPACE_TARGET_REQUIRED" }, { status: 409 });
  }
  if (typeof body.workspaceId !== "string" || !body.workspaceId.trim()) {
    return NextResponse.json({ error: "Workspace cible invalide." }, { status: 400 });
  }
  const workspaceId = body.workspaceId.trim();
  const target = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: owner.id, status: "ACTIVE" }, select: { id: true },
  });
  if (!target) return templateMutationNotFound();

  const template = await prisma.formTemplate.findUnique({
    where: { id: params.templateId },
    include: {
      relationTemplate: true,
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!template?.relationTemplate) {
    return NextResponse.json({ error: "parcours introuvable" }, { status: 404 });
  }

  const sourceRelationTemplate = template.relationTemplate;
  const relationKey = copyKey(sourceRelationTemplate.key);
  const formKey = `${relationKey}_FORM`;
  const created = await prisma.$transaction(async (tx) => {
    const relationTemplate = await tx.relationTemplate.create({
      data: {
        key: relationKey,
        name: `${sourceRelationTemplate.name} - copie`,
        description: sourceRelationTemplate.description,
        status: "DRAFT",
        workspaceId: target.id,
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
