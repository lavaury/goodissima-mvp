import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredRateLimitBuckets, consumeRateLimitBucket } from "@/lib/rate-limit-bucket";

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

export async function incrementPublicCaseRateLimit(client: RateLimitClient, entry: PublicCaseRateLimitEntry, now: Date) {
  const config = PUBLIC_CASE_RATE_LIMITS[entry.dimension];
  return consumeRateLimitBucket(client, { ...entry, ...config }, now);
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
    void cleanupExpiredRateLimitBuckets(prisma, now).catch(() => undefined);
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
