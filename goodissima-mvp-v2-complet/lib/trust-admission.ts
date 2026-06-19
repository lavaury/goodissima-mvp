import type { Prisma, PrismaClient } from "@prisma/client";

import { resolveCandidateIdentityForAdmission } from "./trust-identity";
import { evaluateTrustPolicy } from "./trust-policy-evaluator";
import { resolveRequiredCredentialTypesForTrustPolicy } from "./trust-policy-requirements";

export type TrustAdmissionClient = Prisma.TransactionClient | PrismaClient;

export type EvaluateTrustAdmissionInput = {
  trustPolicyId: string;
  candidateIdentityId?: string | null;
};

export type EvaluateTrustAdmissionResult = {
  allowed: boolean;
  trustPolicyId: string;
  candidateIdentityId: string | null;
  requiredCredentialTypes: string[];
  satisfiedCredentialTypes: string[];
  missingCredentialTypes: string[];
  reasons: string[];
  missingRequirements: string[];
};

export async function evaluateTrustAdmission(
  prisma: TrustAdmissionClient,
  input: EvaluateTrustAdmissionInput,
): Promise<EvaluateTrustAdmissionResult> {
  const requirements = await resolveRequiredCredentialTypesForTrustPolicy(
    prisma,
    input.trustPolicyId,
  );
  const requiredCredentialTypes = requirements.credentialTypeCodes;

  if (requiredCredentialTypes.length === 0) {
    return {
      allowed: true,
      trustPolicyId: input.trustPolicyId,
      candidateIdentityId: input.candidateIdentityId ?? null,
      requiredCredentialTypes,
      satisfiedCredentialTypes: [],
      missingCredentialTypes: [],
      reasons: ["NO_CREDENTIAL_REQUIREMENTS"],
      missingRequirements: [],
    };
  }

  const identityResolution = await resolveCandidateIdentityForAdmission(prisma, {
    candidateIdentityId: input.candidateIdentityId,
  });

  if (!identityResolution.resolved || !identityResolution.identity) {
    return {
      allowed: false,
      trustPolicyId: input.trustPolicyId,
      candidateIdentityId: input.candidateIdentityId ?? null,
      requiredCredentialTypes,
      satisfiedCredentialTypes: [],
      missingCredentialTypes: requiredCredentialTypes,
      reasons: identityResolution.reasons,
      missingRequirements: ["CANDIDATE_IDENTITY"],
    };
  }

  const credentialEvaluation = await evaluateTrustPolicy(prisma, {
    identityId: identityResolution.identity.id,
    requiredCredentialTypes,
  });

  return {
    allowed: credentialEvaluation.allowed,
    trustPolicyId: input.trustPolicyId,
    candidateIdentityId: identityResolution.identity.id,
    requiredCredentialTypes,
    satisfiedCredentialTypes: credentialEvaluation.satisfiedCredentialTypes,
    missingCredentialTypes: credentialEvaluation.missingCredentialTypes,
    reasons: credentialEvaluation.allowed
      ? ["CREDENTIAL_REQUIREMENTS_SATISFIED"]
      : ["CREDENTIAL_REQUIREMENTS_MISSING"],
    missingRequirements: credentialEvaluation.missingCredentialTypes,
  };
}

export function explainTrustAdmissionEvaluation(result: EvaluateTrustAdmissionResult): string {
  if (result.allowed && result.requiredCredentialTypes.length === 0) {
    return "No credential requirements.";
  }

  if (result.allowed) {
    return "Candidate identity satisfies all required credential types.";
  }

  if (result.missingRequirements.includes("CANDIDATE_IDENTITY")) {
    return "Candidate identity is required.";
  }

  return `Missing credential types: ${result.missingCredentialTypes.join(", ")}`;
}
