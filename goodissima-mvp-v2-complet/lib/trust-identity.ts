import { IdentityStatus, type GoodissimaIdentity, type Prisma, type PrismaClient } from "@prisma/client";

export type TrustIdentityClient = Prisma.TransactionClient | PrismaClient;

export type CandidateIdentityResolutionInput = {
  candidateIdentityId?: string | null;
};

export type CandidateIdentityResolutionResult = {
  identity: GoodissimaIdentity | null;
  resolved: boolean;
  reasons: string[];
};

export function isIdentityUsableForAdmission(identity: GoodissimaIdentity): boolean {
  return identity.status === IdentityStatus.UNVERIFIED || identity.status === IdentityStatus.VERIFIED;
}

export async function resolveCandidateIdentityForAdmission(
  prisma: TrustIdentityClient,
  input: CandidateIdentityResolutionInput,
): Promise<CandidateIdentityResolutionResult> {
  if (!input.candidateIdentityId) {
    return {
      identity: null,
      resolved: false,
      reasons: ["NO_CANDIDATE_IDENTITY_PROVIDED"],
    };
  }

  const identity = await prisma.goodissimaIdentity.findUnique({
    where: { id: input.candidateIdentityId },
  });

  if (!identity) {
    return {
      identity: null,
      resolved: false,
      reasons: ["CANDIDATE_IDENTITY_NOT_FOUND"],
    };
  }

  if (!isIdentityUsableForAdmission(identity)) {
    return {
      identity,
      resolved: false,
      reasons: ["CANDIDATE_IDENTITY_NOT_USABLE"],
    };
  }

  return {
    identity,
    resolved: true,
    reasons: ["CANDIDATE_IDENTITY_RESOLVED"],
  };
}
