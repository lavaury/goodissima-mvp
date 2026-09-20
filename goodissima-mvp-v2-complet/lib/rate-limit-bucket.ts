import { Prisma } from "@prisma/client";

export type RateLimitBucketClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
};

export type RateLimitBucketInput = {
  dimension: string;
  keyHash: string;
  windowSeconds: number;
  limit: number;
};

export async function consumeRateLimitBucket(
  client: RateLimitBucketClient,
  input: RateLimitBucketInput,
  now = new Date(),
) {
  if (!input.dimension || input.dimension.length > 80) throw new TypeError("RATE_LIMIT_DIMENSION_INVALID");
  if (!input.keyHash || input.keyHash.length > 128) throw new TypeError("RATE_LIMIT_KEY_INVALID");
  if (!Number.isInteger(input.windowSeconds) || input.windowSeconds < 1) throw new TypeError("RATE_LIMIT_WINDOW_INVALID");
  if (!Number.isInteger(input.limit) || input.limit < 1) throw new TypeError("RATE_LIMIT_THRESHOLD_INVALID");
  const windowMs = input.windowSeconds * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(startMs);
  const expiresAt = new Date(startMs + windowMs);
  const rows = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "PublicRateLimitBucket"
      ("id", "dimension", "keyHash", "windowStart", "windowSeconds", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${crypto.randomUUID()}, ${input.dimension}, ${input.keyHash}, ${windowStart}, ${input.windowSeconds}, 1, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("dimension", "keyHash", "windowStart", "windowSeconds")
    DO UPDATE SET "count" = "PublicRateLimitBucket"."count" + 1, "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "count"
  `);
  const count = Number(rows[0]?.count ?? 0);
  return {
    allowed: count <= input.limit,
    count,
    limit: input.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

export function cleanupExpiredRateLimitBuckets(client: RateLimitBucketClient, now = new Date(), limit = 100) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return client.$executeRaw(Prisma.sql`
    DELETE FROM "PublicRateLimitBucket" WHERE "id" IN (
      SELECT "id" FROM "PublicRateLimitBucket"
      WHERE "expiresAt" <= ${now}
      ORDER BY "expiresAt" ASC
      LIMIT ${boundedLimit}
    )
  `);
}
