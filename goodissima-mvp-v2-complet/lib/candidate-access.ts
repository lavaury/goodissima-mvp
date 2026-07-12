import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

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

export async function resolveCandidateSecureAccess(token: unknown) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) return null;

  return prisma.relationCase.findFirst({
    where: activeCandidateAccessWhere(normalizedToken),
    select: { id: true },
  });
}
