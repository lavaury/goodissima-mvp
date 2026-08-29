import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.ts";

type Database = PrismaClient | Prisma.TransactionClient;

/**
 * Canonical server-side ownership scope for FormTemplate access.
 *
 * Workspace ownership is authoritative. A workspace-less legacy template is
 * accepted only when an existing governed-journey record names the requester
 * as its authority, or its durable creation request names the requester.
 * Unattributed legacy templates fail closed.
 */
export function authorizedFormTemplateWhere(templateId: string, requesterUserId: string): Prisma.FormTemplateWhereInput {
  return {
    id: templateId,
    ...authorizedFormTemplateScopeWhere(requesterUserId),
  };
}

export function authorizedFormTemplateScopeWhere(requesterUserId: string): Prisma.FormTemplateWhereInput {
  return templateScopeWhere(requesterUserId, false);
}

function templateScopeWhere(requesterUserId: string, activeWorkspaceRequired: boolean): Prisma.FormTemplateWhereInput {
  return { relationTemplate: { is: { OR: [
    { workspace: { is: { ownerId: requesterUserId, ...(activeWorkspaceRequired ? { status: "ACTIVE" as const } : {}) } } },
    { workspaceId: null, governedJourney: { is: { authorityUserId: requesterUserId } }, governedJourneyCreationRequest: { is: null } },
    { workspaceId: null, governedJourney: { is: null }, governedJourneyCreationRequest: { is: { requesterUserId } } },
    { workspaceId: null, governedJourney: { is: { authorityUserId: requesterUserId } }, governedJourneyCreationRequest: { is: { requesterUserId } } },
  ] } } };
}

export function authorizedMutableFormTemplateWhere(templateId: string, requesterUserId: string): Prisma.FormTemplateWhereInput {
  return { id: templateId, ...templateScopeWhere(requesterUserId, true) };
}

export function authorizedFormFieldWhere(fieldId: string, requesterUserId: string): Prisma.FormFieldWhereInput {
  return { id: fieldId, formTemplate: { is: authorizedFormTemplateScopeWhere(requesterUserId) } };
}

export function authorizedMutableFormFieldWhere(fieldId: string, requesterUserId: string): Prisma.FormFieldWhereInput {
  return { id: fieldId, formTemplate: { is: templateScopeWhere(requesterUserId, true) } };
}

export async function resolveAuthorizedFormTemplate(
  templateId: string,
  requesterUserId: string,
  database: Database = prisma,
) {
  return database.formTemplate.findFirst({
    where: authorizedFormTemplateWhere(templateId, requesterUserId),
    select: { id: true, relationTemplateId: true, relationTemplate: { select: { id: true, workspaceId: true } } },
  });
}

export async function resolveAuthorizedFormField(
  fieldId: string,
  requesterUserId: string,
  database: Database = prisma,
) {
  return database.formField.findFirst({
    where: authorizedFormFieldWhere(fieldId, requesterUserId),
    select: { id: true, formTemplateId: true },
  });
}

export async function resolveAuthorizedMutableFormTemplate(
  templateId: string,
  requesterUserId: string,
  database: Database = prisma,
) {
  return database.formTemplate.findFirst({
    where: authorizedMutableFormTemplateWhere(templateId, requesterUserId),
    select: { id: true, relationTemplateId: true, relationTemplate: { select: { id: true, workspaceId: true } } },
  });
}

export async function resolveAuthorizedMutableFormField(
  fieldId: string,
  requesterUserId: string,
  database: Database = prisma,
) {
  return database.formField.findFirst({
    where: authorizedMutableFormFieldWhere(fieldId, requesterUserId),
    select: { id: true, formTemplateId: true },
  });
}

export type TemplateWorkspaceDestination =
  | { kind: "RESOLVED"; workspace: { id: string; name: string }; source: "EXPLICIT" | "SINGLE" }
  | { kind: "ZERO" }
  | { kind: "MULTIPLE" }
  | { kind: "INVALID_SELECTION" };

export async function resolveTemplateWorkspaceDestination(
  requesterUserId: string,
  requestedWorkspaceId: string | null | undefined,
  database: Database = prisma,
): Promise<TemplateWorkspaceDestination> {
  const requested = requestedWorkspaceId?.trim() || null;
  if (requested) {
    const rows = await database.workspace.findMany({
      where: { id: requested, ownerId: requesterUserId, status: "ACTIVE" },
      take: 1,
      select: { id: true, name: true },
    });
    return rows[0] ? { kind: "RESOLVED", workspace: rows[0], source: "EXPLICIT" } : { kind: "INVALID_SELECTION" };
  }

  const rows = await database.workspace.findMany({
    where: { ownerId: requesterUserId, status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 2,
    select: { id: true, name: true },
  });
  if (rows.length === 0) return { kind: "ZERO" };
  if (rows.length > 1) return { kind: "MULTIPLE" };
  return { kind: "RESOLVED", workspace: rows[0], source: "SINGLE" };
}
