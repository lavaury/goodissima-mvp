import type { GovernedMemoryPermission } from "@prisma/client";
import { ROLE_PERMISSIONS } from "@/lib/governed-memory/permissions";
import { governedMemoryRepository, type GovernedMemoryRepository } from "./repository";

export type ResolvedMemoryPermissions = {
  relationCaseId: string;
  userId: string;
  permissions: ReadonlySet<GovernedMemoryPermission>;
  sourceResourceIds: ReadonlySet<string>;
  isOwner: boolean;
};

export async function resolveMemoryPermissions(relationCaseId: string, userId: string, now: Date, repository: GovernedMemoryRepository = governedMemoryRepository): Promise<ResolvedMemoryPermissions | null> {
  const memoryCase = await repository.findCase(relationCaseId);
  if (!memoryCase || memoryCase.governanceStatus === "BLOCKED") return null;
  const representationIds = await repository.findOwnedRepresentationIds(userId);
  const [roles, grants] = await Promise.all([
    repository.findActiveRoles(relationCaseId, userId, now),
    repository.findEffectiveGrants(relationCaseId, userId, representationIds, now),
  ]);
  const permissions = new Set<GovernedMemoryPermission>();
  if (memoryCase.ownerId === userId) for (const permission of ROLE_PERMISSIONS.RELATION_CASE_OWNER) permissions.add(permission);
  for (const { role } of roles) for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission as GovernedMemoryPermission);
  for (const grant of grants) if (!grant.resourceType && !grant.resourceId) permissions.add(grant.permission);
  return { relationCaseId, userId, permissions, sourceResourceIds: new Set(grants.filter((grant) => grant.resourceType === "SOURCE" && grant.resourceId).map((grant) => grant.resourceId as string)), isOwner: memoryCase.ownerId === userId };
}

const may = (resolved: ResolvedMemoryPermissions | null, permission: GovernedMemoryPermission) => resolved?.permissions.has(permission) === true;
export const canProposeFact = (resolved: ResolvedMemoryPermissions | null) => may(resolved, "PROPOSE_FACT");
export const canEstablishFact = (resolved: ResolvedMemoryPermissions | null) => may(resolved, "ESTABLISH_FACT");
export const canValidateDecision = (resolved: ResolvedMemoryPermissions | null) => may(resolved, "VALIDATE_DECISION");
export const canPromotePrivateSource = (resolved: ResolvedMemoryPermissions | null) => may(resolved, "PROMOTE_PRIVATE_SOURCE");
export const canManageMemoryAccess = (resolved: ResolvedMemoryPermissions | null) => may(resolved, "MANAGE_MEMORY_ACCESS");
export function canViewMemoryObject(resolved: ResolvedMemoryPermissions | null, input: { type: "FACT" | "DECISION" | "SOURCE"; id: string; restricted: boolean }) {
  if (!may(resolved, input.type === "SOURCE" ? "VIEW_SOURCES" : "VIEW_MEMORY")) return false;
  return !input.restricted || (input.type === "SOURCE" && resolved?.sourceResourceIds.has(input.id) === true);
}
