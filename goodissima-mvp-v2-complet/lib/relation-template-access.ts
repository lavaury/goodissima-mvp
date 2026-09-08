import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Exact identity seeded by 20260520003000 and reused by the historical link flow.
// isDefault, a matching key alone, or catalogue visibility never grants access.
const systemId = "rel_tpl_default_secure_conversation";
const systemKey = "DEFAULT_SECURE_CONVERSATION";
const source = "governance-v1-minimal-create";

export const templateAccessSelect = {
  id: true, key: true, status: true, workspaceId: true,
  workspace: { select: { ownerId: true } },
  generations: {
    where: { status: "VALIDATED", validatedAt: { not: null } },
    select: { createdById: true }, distinct: ["createdById"], take: 2,
  },
  versions: { where: { version: 1 }, select: { snapshot: true }, take: 1 },
} satisfies Prisma.RelationTemplateSelect;

type Evidence = Prisma.RelationTemplateGetPayload<{ select: typeof templateAccessSelect }>;

export function resolveTemplateAccess(userId: string, template: Evidence) {
  const creators = new Set(template.generations.map(generation => generation.createdById));
  const snapshot = template.versions[0]?.snapshot;
  const metadata = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot.metadata : null;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)
    && metadata.source === source && typeof metadata.createdById === "string" && metadata.createdById) {
    creators.add(metadata.createdById);
  }
  // Same ownership evidence and Workspace precedence as DEBT-AUTH-01.
  const read = Boolean(userId) && (template.workspaceId
    ? template.workspace?.ownerId === userId
    : creators.size === 1 && creators.has(userId));
  const system = template.id === systemId && template.key === systemKey
    && template.workspaceId === null && creators.size === 0;
  // USE includes the seeded system form; READ of a private cockpit does not.
  // Neither permission is a mutation capability.
  return { read, use: Boolean(userId) && template.status !== "ARCHIVED" && (read || system) };
}

export async function getTemplateReadAccess(user: { id: string }, formTemplateId: string) {
  const form = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    select: { id: true, relationTemplate: { select: templateAccessSelect } },
  });
  return form?.relationTemplate && resolveTemplateAccess(user.id, form.relationTemplate).read
    ? { formTemplateId: form.id, relationTemplateId: form.relationTemplate.id } : null;
}

export async function getTemplateForLinkCreation(user: { id: string }, templateId: string | null) {
  // Missing selection preserves only the exact system fallback. An invalid or
  // forbidden explicit selection must never fall back to another template.
  const template = await prisma.relationTemplate.findUnique({
    where: { id: templateId ?? systemId }, select: templateAccessSelect,
  });
  return template && resolveTemplateAccess(user.id, template).use ? { id: template.id } : null;
}

/** Server-scoped candidates; resolveTemplateAccess must still reject conflicting proofs. */
export function getTemplateCreationProofWhere(userId: string): Prisma.RelationTemplateWhereInput {
  return {
    workspaceId: null,
    OR: [
      { generations: { some: { createdById: userId, status: "VALIDATED", validatedAt: { not: null } } } },
      { versions: { some: { version: 1, AND: [
        { snapshot: { path: ["metadata", "source"], equals: source } },
        { snapshot: { path: ["metadata", "createdById"], equals: userId } },
      ] } } },
    ],
  };
}

export async function getAccessibleRelationTemplateIds(userId: string, permission: "read" | "use" = "read") {
  const creationProof = getTemplateCreationProofWhere(userId);
  const templates = await prisma.relationTemplate.findMany({
    where: { OR: [
      { workspace: { ownerId: userId } }, creationProof,
      ...(permission === "use" ? [{ id: systemId, key: systemKey, workspaceId: null }] : []),
    ] },
    select: templateAccessSelect,
  });
  // Check all reliable creators, including contradictory evidence, in one batch.
  return templates.filter(template => resolveTemplateAccess(userId, template)[permission]).map(template => template.id);
}
