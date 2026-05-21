import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_FORM_TEMPLATE_KEY = "DEFAULT_SECURE_CONVERSATION_FORM";

export function getFormTemplateByKey(key: string) {
  return prisma.formTemplate.findUnique({
    where: { key },
  });
}

export function getFormFields(formTemplateId: string) {
  return prisma.formField.findMany({
    where: { formTemplateId },
    orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}

export function createFormSubmission({
  formTemplateId,
  caseId,
  answers,
}: {
  formTemplateId: string;
  caseId?: string | null;
  answers: Prisma.InputJsonValue;
}) {
  return prisma.formSubmission.create({
    data: {
      formTemplateId,
      caseId: caseId ?? null,
      answers,
    },
  });
}
