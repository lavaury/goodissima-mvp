import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const keyHash = `staging-verification-${randomUUID()}`;
const now = new Date();
const windowSeconds = 600;
const windowMs = windowSeconds * 1000;
const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
const expiresAt = new Date(windowStart.getTime() + windowMs);

async function increment() {
  const rows = await prisma.$queryRaw(Prisma.sql`
    INSERT INTO "PublicRateLimitBucket"
      ("id", "dimension", "keyHash", "windowStart", "windowSeconds", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${"SOURCE_10_MIN"}, ${keyHash}, ${windowStart}, ${windowSeconds}, 1, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("dimension", "keyHash", "windowStart", "windowSeconds")
    DO UPDATE SET "count" = "PublicRateLimitBucket"."count" + 1, "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "count"
  `);
  return Number(rows[0]?.count ?? 0);
}

try {
  const counts = await Promise.all(Array.from({ length: 100 }, increment));
  assert.equal(Math.max(...counts), 100);
  const bucket = await prisma.publicRateLimitBucket.findFirstOrThrow({
    where: { dimension: "SOURCE_10_MIN", keyHash }, select: { count: true },
  });
  assert.equal(bucket.count, 100);
  console.info("Public case rate-limit Staging concurrency verification passed", { requests: 100, finalCount: bucket.count });
} finally {
  await prisma.publicRateLimitBucket.deleteMany({ where: { keyHash } });
  await prisma.$disconnect();
}
