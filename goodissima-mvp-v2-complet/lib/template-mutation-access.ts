import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** templateId is a FormTemplate id, not a RelationTemplate id. */
export async function getTemplateMutationAccess(user: { id: string }, templateId: string) {
  const form = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, relationTemplate: { select: {
      id: true, workspaceId: true, workspace: { select: { ownerId: true } },
    } } },
  });
  const template = form?.relationTemplate;
  if (!template) return null;

  // An attached Workspace is authoritative. Historical evidence cannot grant
  // access to another owner's Workspace (or to a dangling attachment).
  if (template.workspaceId) {
    return template.workspace?.ownerId === user.id
      ? { formTemplateId: form.id, relationTemplateId: template.id }
      : null;
  }

  // These are server-recorded creation proofs, not ownership inferred from
  // links, visibility, isDefault, critic reports or later edits.
  const [generations, initialVersion] = await Promise.all([
    prisma.templateGeneration.findMany({
      where: { templateId: template.id, status: "VALIDATED", validatedAt: { not: null } },
      select: { createdById: true }, distinct: ["createdById"], take: 2,
    }),
    prisma.templateVersion.findFirst({
      where: { templateId: template.id, version: 1 }, select: { snapshot: true },
    }),
  ]);
  const creators = new Set(generations.map(generation => generation.createdById));
  const snapshot = initialVersion?.snapshot;
  const metadata = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot.metadata : null;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)
    && metadata.source === "governance-v1-minimal-create"
    && typeof metadata.createdById === "string" && metadata.createdById) {
    creators.add(metadata.createdById);
  }
  return creators.size === 1 && creators.has(user.id)
    ? { formTemplateId: form.id, relationTemplateId: template.id }
    : null;
}

export function templateMutationNotFound() {
  return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });
}
