import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// RECOMMANDATION V1 À AJUSTER APRÈS OBSERVATION STAGING.
export const PUBLIC_CASE_RATE_LIMITS = {
  SOURCE_10_MIN: { windowSeconds: 10 * 60, limit: 10 },
  SOURCE_24_H: { windowSeconds: 24 * 60 * 60, limit: 50 },
  GLINK_1_H: { windowSeconds: 60 * 60, limit: 60 },
  GLINK_24_H: { windowSeconds: 24 * 60 * 60, limit: 300 },
  OWNER_1_H: { windowSeconds: 60 * 60, limit: 200 },
  OWNER_24_H: { windowSeconds: 24 * 60 * 60, limit: 1000 },
} as const;

export type PublicCaseRateLimitDimension = keyof typeof PUBLIC_CASE_RATE_LIMITS;
export type PublicCaseRateLimitEntry = { dimension: PublicCaseRateLimitDimension; keyHash: string };
export type PublicCaseRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; dimension: PublicCaseRateLimitDimension };

type RateLimitClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
};

function windowFor(now: Date, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return { start: new Date(startMs), expiresAt: new Date(startMs + windowMs), retryAfterSeconds: Math.max(1, Math.ceil((startMs + windowMs - now.getTime()) / 1000)) };
}

export async function incrementPublicCaseRateLimit(client: RateLimitClient, entry: PublicCaseRateLimitEntry, now: Date) {
  const config = PUBLIC_CASE_RATE_LIMITS[entry.dimension];
  const window = windowFor(now, config.windowSeconds);
  const id = crypto.randomUUID();
  const rows = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "PublicRateLimitBucket"
      ("id", "dimension", "keyHash", "windowStart", "windowSeconds", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${id}, ${entry.dimension}, ${entry.keyHash}, ${window.start}, ${config.windowSeconds}, 1, ${window.expiresAt}, ${now}, ${now})
    ON CONFLICT ("dimension", "keyHash", "windowStart", "windowSeconds")
    DO UPDATE SET "count" = "PublicRateLimitBucket"."count" + 1, "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "count"
  `);
  return { count: Number(rows[0]?.count ?? 0), limit: config.limit, retryAfterSeconds: window.retryAfterSeconds };
}

export async function checkPublicCaseCreationLimit(entries: PublicCaseRateLimitEntry[], now = new Date()): Promise<PublicCaseRateLimitResult> {
  const result = await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const current = await incrementPublicCaseRateLimit(tx, entry, now);
      if (current.count > current.limit) return { allowed: false as const, retryAfterSeconds: current.retryAfterSeconds, dimension: entry.dimension };
    }
    return { allowed: true as const };
  });

  // Deterministic ~1/256 opportunistic cleanup, bounded to 100 expired rows.
  if (entries[0] && Number.parseInt(entries[0].keyHash.slice(0, 2), 16) === 0) {
    void prisma.$executeRaw(Prisma.sql`
      DELETE FROM "PublicRateLimitBucket" WHERE "id" IN (
        SELECT "id" FROM "PublicRateLimitBucket" WHERE "expiresAt" <= ${now} ORDER BY "expiresAt" ASC LIMIT 100
      )
    `).catch(() => undefined);
  }
  return result;
}

export function publicCaseTargetRateLimitEntries(gLinkId: string, ownerId: string): PublicCaseRateLimitEntry[] {
  return [
    { dimension: "GLINK_1_H", keyHash: gLinkId }, { dimension: "GLINK_24_H", keyHash: gLinkId },
    { dimension: "OWNER_1_H", keyHash: ownerId }, { dimension: "OWNER_24_H", keyHash: ownerId },
  ];
}

export function publicCaseSourceRateLimitEntries(sourceKeyHash: string): PublicCaseRateLimitEntry[] {
  return [
    { dimension: "SOURCE_10_MIN", keyHash: sourceKeyHash },
    { dimension: "SOURCE_24_H", keyHash: sourceKeyHash },
  ];
}
