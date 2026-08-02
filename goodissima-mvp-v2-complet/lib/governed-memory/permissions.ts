import type { GovernedMemoryAccessGrant, GovernedMemoryPermission, GovernedMemoryRole, GovernedMemoryVisibility, UserId } from "./types";
import { wasAccessibleAt } from "./temporal.ts";

export const ROLE_PERMISSIONS: Readonly<Record<GovernedMemoryRole, readonly GovernedMemoryPermission[]>> = {
  RELATION_CASE_OWNER: ["VIEW_MEMORY", "VIEW_SOURCES", "PROPOSE_FACT", "DISPUTE_FACT", "RECORD_DECISION"],
  MEMORY_STEWARD: ["VIEW_MEMORY", "PROPOSE_FACT", "ESTABLISH_FACT", "DISPUTE_FACT", "RECORD_DECISION", "VALIDATE_DECISION", "VALIDATE_SYNTHESIS", "MANAGE_MEMORY_ACCESS", "PROMOTE_PRIVATE_SOURCE"],
  MEMORY_DELEGATE: ["VIEW_MEMORY", "PROPOSE_FACT", "ESTABLISH_FACT", "DISPUTE_FACT", "RECORD_DECISION", "VALIDATE_DECISION", "VALIDATE_SYNTHESIS", "PROMOTE_PRIVATE_SOURCE"],
  CONTRIBUTOR: ["VIEW_MEMORY", "PROPOSE_FACT", "DISPUTE_FACT"],
  READER: ["VIEW_MEMORY"],
  REVOKED_PARTICIPANT: [],
  SYSTEM: [],
  AI_ASSISTANT: [],
};

export function roleMay(role: GovernedMemoryRole, permission: GovernedMemoryPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasPermissionAt(grants: readonly GovernedMemoryAccessGrant[], permission: GovernedMemoryPermission, at: string): boolean {
  return grants.some((grant) => grant.permission === permission && wasAccessibleAt(grant, at));
}

export function hasCurrentPermission(grants: readonly GovernedMemoryAccessGrant[], permission: GovernedMemoryPermission, now: string): boolean {
  return hasPermissionAt(grants, permission, now);
}

export function resolveResidualAccess(grant: GovernedMemoryAccessGrant, at: string): readonly GovernedMemoryPermission[] {
  if (!grant.residualAccessPolicy || !grant.revokedAt) return [];
  const reference = Date.parse(at);
  const revoked = Date.parse(grant.revokedAt);
  const until = Date.parse(grant.residualAccessPolicy.effectiveUntil);
  return Number.isFinite(reference) && reference >= revoked && reference < until ? grant.residualAccessPolicy.permissions : [];
}

export function canViewHistoricalElement(input: {
  requesterUserId: UserId;
  currentGrants: readonly GovernedMemoryAccessGrant[];
  historicalGrants: readonly GovernedMemoryAccessGrant[];
  visibility: GovernedMemoryVisibility;
  at: string;
  now: string;
}): boolean {
  if (!hasCurrentPermission(input.currentGrants, "VIEW_MEMORY", input.now)) return false;
  if (!hasPermissionAt(input.historicalGrants, "VIEW_MEMORY", input.at)) return false;
  if (input.visibility.kind === "PRIVATE_TO_AUTHOR") return false;
  if (input.visibility.kind === "SPECIFIC_SUBJECTS") return input.visibility.subjectUserIds?.includes(input.requesterUserId) === true;
  if (input.visibility.kind === "RESTRICTED") return Boolean(input.visibility.policyRef);
  return true;
}
