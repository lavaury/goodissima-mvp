import { prisma } from "@/lib/prisma";

export const DEFAULT_RELATION_TEMPLATE_KEY = "DEFAULT_SECURE_CONVERSATION";

export function getDefaultRelationTemplate() {
  return prisma.relationTemplate.findUnique({
    where: { key: DEFAULT_RELATION_TEMPLATE_KEY },
  });
}

/** Resolve an already-authorized public link/case template, not a USE permission.
 * New owner-side links must use getTemplateForLinkCreation instead. */
export async function getRelationTemplateForLink(templateId?: string | null) {
  const selectedTemplate = templateId
    ? await prisma.relationTemplate.findUnique({
        where: { id: templateId },
      })
    : null;

  return selectedTemplate ?? getDefaultRelationTemplate();
}
