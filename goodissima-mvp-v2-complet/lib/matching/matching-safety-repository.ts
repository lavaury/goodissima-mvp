import { Prisma, type PrismaClient } from "@prisma/client";
import { MATCHING_EXECUTION_LEASE_MS } from "./matching-safety.ts";

type MatchingSafetyClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "matchingRun">;

export function findReusableMatchingRun(client: MatchingSafetyClient, input: {
  ownerId: string;
  gLinkId: string;
  criteriaFingerprintHash: string;
  now?: Date;
}) {
  return client.matchingRun.findFirst({
    where: {
      ownerId: input.ownerId,
      gLinkId: input.gLinkId,
      criteriaFingerprintHash: input.criteriaFingerprintHash,
      status: "RESULTS_AVAILABLE",
      cacheValidUntil: { gt: input.now ?? new Date() },
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
  });
}

export async function acquireMatchingExecutionLease(client: MatchingSafetyClient, input: {
  ownerId: string;
  gLinkId: string;
  criteriaFingerprintHash: string;
  now?: Date;
  leaseMs?: number;
}) {
  const now = input.now ?? new Date();
  const leaseMs = Math.max(1_000, Math.min(10 * 60 * 1000, Math.trunc(input.leaseMs ?? MATCHING_EXECUTION_LEASE_MS)));
  const expiresAt = new Date(now.getTime() + leaseMs);
  const rows = await client.$queryRaw<Array<{ id: string; expiresAt: Date }>>(Prisma.sql`
    INSERT INTO "MatchingExecutionLease"
      ("id", "ownerId", "gLinkId", "criteriaFingerprintHash", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${crypto.randomUUID()}, ${input.ownerId}, ${input.gLinkId}, ${input.criteriaFingerprintHash}, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("ownerId", "gLinkId", "criteriaFingerprintHash")
    DO UPDATE SET "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = EXCLUDED."updatedAt"
    WHERE "MatchingExecutionLease"."expiresAt" <= ${now}
    RETURNING "id", "expiresAt"
  `);
  return rows[0] ? { acquired: true as const, leaseId: rows[0].id, expiresAt: rows[0].expiresAt } : { acquired: false as const };
}

export function releaseMatchingExecutionLease(client: MatchingSafetyClient, input: {
  leaseId: string;
  ownerId: string;
  gLinkId: string;
  criteriaFingerprintHash: string;
}) {
  return client.$executeRaw(Prisma.sql`
    DELETE FROM "MatchingExecutionLease"
    WHERE "id" = ${input.leaseId}
      AND "ownerId" = ${input.ownerId}
      AND "gLinkId" = ${input.gLinkId}
      AND "criteriaFingerprintHash" = ${input.criteriaFingerprintHash}
  `);
}

export function cleanupExpiredMatchingExecutionLeases(client: MatchingSafetyClient, now = new Date(), limit = 100) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return client.$executeRaw(Prisma.sql`
    DELETE FROM "MatchingExecutionLease" WHERE "id" IN (
      SELECT "id" FROM "MatchingExecutionLease"
      WHERE "expiresAt" <= ${now}
      ORDER BY "expiresAt" ASC
      LIMIT ${boundedLimit}
    )
  `);
}
