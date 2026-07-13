import { prisma } from "./prisma";
import { secureTrace } from "./secure-trace";
import { pickCanonicalRelationCaseId } from "./canonical-relation-case-picker";

/**
 * Pick the case which is actually carrying the candidate conversation.
 * This is deliberately a routing decision only: no historical case is mutated.
 */
/**
 * Resolve legacy Trust Admission duplicates through their stable candidate
 * identity and GLink. Email-only cases (including Garage) are left untouched.
 */
export async function resolveCanonicalOwnerRelationCaseId(caseId: string, ownerId: string) {
  const requested = await prisma.relationCase.findFirst({
    where: { id: caseId, ownerId },
    select: { id: true, gLinkId: true, candidateIdentityId: true },
  });
  if (!requested?.candidateIdentityId) return requested?.id ?? null;

  const candidates = await prisma.relationCase.findMany({
    where: {
      ownerId,
      gLinkId: requested.gLinkId,
      candidateIdentityId: requested.candidateIdentityId,
    },
    select: {
      id: true,
      createdAt: true,
      candidateAccessRevokedAt: true,
      candidateAccessExpiresAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const canonicalId = pickCanonicalRelationCaseId(candidates);
  if (canonicalId && canonicalId !== requested.id) {
    secureTrace("owner_case_canonical_redirect", {
      requestedRelationCaseId: requested.id,
      canonicalRelationCaseId: canonicalId,
    });
  }
  return canonicalId ?? requested.id;
}

export { pickCanonicalRelationCaseId } from "./canonical-relation-case-picker";
