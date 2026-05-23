import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function copyKey(baseKey: string) {
  return `${baseKey}_COPY_${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 80);
}

export async function POST(_req: Request, { params }: { params: { templateId: string } }) {
  await getCurrentPrismaUser();

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
