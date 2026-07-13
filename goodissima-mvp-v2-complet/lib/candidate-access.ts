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
  const result = await diagnoseCandidateSecureAccess(token);
  return result.status === "resolved" ? { id: result.relationCaseId } : null;
}

export type CandidateSecureAccessDiagnostic =
  | { status: "resolved"; relationCaseId: string }
  | { status: "rejected"; reason: "absent-token" | "unknown-token" | "revoked" | "expired" };

export async function diagnoseCandidateSecureAccess(token: unknown): Promise<CandidateSecureAccessDiagnostic> {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) return { status: "rejected", reason: "absent-token" };

  const relationCase = await prisma.relationCase.findUnique({
    where: { candidateAccessToken: normalizedToken },
    select: { id: true, candidateAccessRevokedAt: true, candidateAccessExpiresAt: true },
  });
  if (!relationCase) return { status: "rejected", reason: "unknown-token" };
  if (relationCase.candidateAccessRevokedAt) return { status: "rejected", reason: "revoked" };
  if (relationCase.candidateAccessExpiresAt && relationCase.candidateAccessExpiresAt <= new Date()) {
    return { status: "rejected", reason: "expired" };
  }
  return { status: "resolved", relationCaseId: relationCase.id };
}
