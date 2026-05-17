import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

export const CANDIDATE_ACCESS_TTL_DAYS = 30;

export function createCandidateAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function createCandidateAccessExpiresAt(now = new Date()) {
  return new Date(now.getTime() + CANDIDATE_ACCESS_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function activeCandidateAccessWhere(
  token: string,
  now = new Date(),
): Prisma.RelationCaseWhereInput {
  return {
    candidateAccessToken: token,
    candidateAccessRevokedAt: null,
    OR: [{ candidateAccessExpiresAt: null }, { candidateAccessExpiresAt: { gt: now } }],
  };
}
