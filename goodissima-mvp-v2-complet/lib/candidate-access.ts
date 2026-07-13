import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { secureTokenHash, secureTrace } from "./secure-trace";

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
  const tokenHash = await secureTokenHash(normalizedToken);
  secureTrace("resolver_start", { tokenHash, tokenLength: normalizedToken.length });
  if (!normalizedToken) {
    secureTrace("resolver_result", { tokenHash, status: "missing-token", expiresAtPresent: false, revokedAtPresent: false });
    return { status: "rejected", reason: "absent-token" };
  }

  try {
    const relationCase = await prisma.relationCase.findUnique({
      where: { candidateAccessToken: normalizedToken },
      select: { id: true, candidateAccessRevokedAt: true, candidateAccessExpiresAt: true },
    });
    if (!relationCase) {
      secureTrace("resolver_result", { tokenHash, status: "unknown-token", expiresAtPresent: false, revokedAtPresent: false });
      return { status: "rejected", reason: "unknown-token" };
    }
    const resultData = {
      tokenHash,
      relationCaseId: relationCase.id,
      expiresAtPresent: Boolean(relationCase.candidateAccessExpiresAt),
      revokedAtPresent: Boolean(relationCase.candidateAccessRevokedAt),
    };
    if (relationCase.candidateAccessRevokedAt) {
      secureTrace("resolver_result", { ...resultData, status: "revoked" });
      return { status: "rejected", reason: "revoked" };
    }
    if (relationCase.candidateAccessExpiresAt && relationCase.candidateAccessExpiresAt <= new Date()) {
      secureTrace("resolver_result", { ...resultData, status: "expired" });
      return { status: "rejected", reason: "expired" };
    }
    secureTrace("resolver_result", { ...resultData, status: "resolved" });
    return { status: "resolved", relationCaseId: relationCase.id };
  } catch (error) {
    secureTrace("resolver_result", { tokenHash, status: "error", expiresAtPresent: false, revokedAtPresent: false });
    throw error;
  }
}
