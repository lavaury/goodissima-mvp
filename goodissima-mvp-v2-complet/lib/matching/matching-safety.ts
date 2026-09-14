import { createHmac } from "node:crypto";
import { RATE_LIMIT_SECRET_ENV } from "../public-request-source.ts";
import { canonicalMatchingJson } from "./matching-lifecycle-service.ts";
import type { MatchableOpportunityProjectionV1 } from "../opportunities/matching/matchable-projection.ts";
import { consumeRateLimitBucket, type RateLimitBucketClient } from "../rate-limit-bucket.ts";

export const CROSS_OWNER_MATCHING_FLAG_ENV = "FEATURE_CROSS_OWNER_MATCHING";
export const MATCHING_CACHE_TTL_MS = 10 * 60 * 1000;
export const MATCHING_EXECUTION_LEASE_MS = 2 * 60 * 1000;
export const MATCHING_RUN_RETENTION_DAYS = 30;

export const MATCHING_RATE_LIMITS = {
  MATCH_USER_10M: { windowSeconds: 10 * 60, limit: 5 },
  MATCH_USER_24H: { windowSeconds: 24 * 60 * 60, limit: 30 },
  MATCH_OWNER_10M: { windowSeconds: 10 * 60, limit: 15 },
  MATCH_OWNER_24H: { windowSeconds: 24 * 60 * 60, limit: 75 },
  MATCH_OPPORTUNITY_10M: { windowSeconds: 10 * 60, limit: 3 },
  MATCH_OPPORTUNITY_24H: { windowSeconds: 24 * 60 * 60, limit: 20 },
} as const;

export type MatchingRateLimitDimension = keyof typeof MATCHING_RATE_LIMITS;

export function isCrossOwnerMatchingEnabled(environment: Readonly<Record<string, string | undefined>> = process.env) {
  return environment[CROSS_OWNER_MATCHING_FLAG_ENV] === "true";
}

function matchingHmac(value: string, secret = process.env[RATE_LIMIT_SECRET_ENV]) {
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_SECRET_UNAVAILABLE");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function matchingCriteriaFingerprintHash(input: {
  projection: MatchableOpportunityProjectionV1;
  engineVersion: string;
  comparatorPolicyVersion: string;
}, secret = process.env[RATE_LIMIT_SECRET_ENV]) {
  const canonical = canonicalMatchingJson({
    comparatorPolicyVersion: input.comparatorPolicyVersion,
    engineVersion: input.engineVersion,
    projection: input.projection,
  });
  return matchingHmac(`matching:fingerprint:v1:${canonical}`, secret);
}

function matchingQuotaKey(kind: "user" | "owner" | "opportunity", value: string, secret?: string) {
  return matchingHmac(`matching:quota:v1:${kind}:${value}`, secret);
}

export function matchingRateLimitEntries(input: {
  userId: string;
  ownerId: string;
  opportunityId: string;
}, secret = process.env[RATE_LIMIT_SECRET_ENV]) {
  const keys = {
    user: matchingQuotaKey("user", input.userId, secret),
    owner: matchingQuotaKey("owner", input.ownerId, secret),
    opportunity: matchingQuotaKey("opportunity", input.opportunityId, secret),
  };
  return (Object.entries(MATCHING_RATE_LIMITS) as Array<[MatchingRateLimitDimension, { windowSeconds: number; limit: number }]>).map(
    ([dimension, policy]) => ({
      dimension,
      keyHash: dimension.startsWith("MATCH_USER_") ? keys.user : dimension.startsWith("MATCH_OWNER_") ? keys.owner : keys.opportunity,
      ...policy,
    }),
  );
}

export async function consumeMatchingRateLimits(
  client: RateLimitBucketClient,
  entries: ReturnType<typeof matchingRateLimitEntries>,
  now = new Date(),
) {
  for (const entry of entries) {
    const result = await consumeRateLimitBucket(client, entry, now);
    if (!result.allowed) return { allowed: false as const, dimension: entry.dimension, retryAfterSeconds: result.retryAfterSeconds };
  }
  return { allowed: true as const };
}
