import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPublicJourneyMemoryRoleKey } from "./persistence/transition-idempotency";

type Database = PrismaClient | Prisma.TransactionClient;
type PublicRole = "MEMORY_STEWARD" | "MEMORY_DELEGATE";
const labels: Record<PublicRole, string> = { MEMORY_STEWARD: "Responsable de la mémoire", MEMORY_DELEGATE: "Délégué à la mémoire" };

async function root(database: Database, input: { requesterUserId: string; formTemplateId: string }) {
  return database.formTemplate.findFirst({ where: { id: input.formTemplateId, relationTemplate: { workspace: { ownerId: input.requesterUserId, status: "ACTIVE" } } }, select: { relationTemplate: { select: { id: true, governedJourney: { select: { id: true } } } } } });
}

export async function listActiveJourneyMemoryRolesForCockpit(input: { requesterUserId: string; formTemplateId: string }, database: PrismaClient = prisma) {
  const resolved = await root(database, input); const journey = resolved?.relationTemplate?.governedJourney;
  if (!journey) return null;
  const rows = await database.governedJourneyMemoryRoleAssignment.findMany({ where: { governedJourneyId: journey.id, relationTemplateId: resolved.relationTemplate!.id, revokedAt: null, role: { in: ["MEMORY_STEWARD", "MEMORY_DELEGATE"] } }, select: { userId: true, role: true, user: { select: { name: true } } }, orderBy: [{ createdAt: "asc" }] });
  return rows.map((row) => ({ beneficiaryKey: buildPublicJourneyMemoryRoleKey({ governedJourneyId: journey.id, userId: row.userId, role: row.role }), displayName: row.user.name?.trim() || "Utilisateur Goodissima", roleLabel: labels[row.role], isOrganizerSteward: row.userId === input.requesterUserId && row.role === "MEMORY_STEWARD" }));
}

export async function resolveActiveJourneyMemoryRolePublicKey(input: { requesterUserId: string; formTemplateId: string; beneficiaryKey: string }, database: PrismaClient = prisma) {
  if (!/^[0-9a-f]{64}$/.test(input.beneficiaryKey)) return null;
  const resolved = await root(database, input); const journey = resolved?.relationTemplate?.governedJourney;
  if (!journey) return null;
  const rows = await database.governedJourneyMemoryRoleAssignment.findMany({ where: { governedJourneyId: journey.id, relationTemplateId: resolved.relationTemplate!.id, revokedAt: null, role: { in: ["MEMORY_STEWARD", "MEMORY_DELEGATE"] } }, select: { userId: true, role: true } });
  const row = rows.find((candidate) => buildPublicJourneyMemoryRoleKey({ governedJourneyId: journey.id, userId: candidate.userId, role: candidate.role }) === input.beneficiaryKey);
  return row ? { targetUserId: row.userId, role: row.role } : null;
}
