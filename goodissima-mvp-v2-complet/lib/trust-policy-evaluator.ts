import { Prisma, TrustCredentialStatus, type PrismaClient } from "@prisma/client";

export type TrustPolicyEvaluatorClient = Prisma.TransactionClient | PrismaClient;

export type EvaluateTrustPolicyInput = {
  identityId: string;
  requiredCredentialTypes: string[];
};

export type EvaluateTrustPolicyResult = {
  allowed: boolean;
  satisfiedCredentialTypes: string[];
  missingCredentialTypes: string[];
};

export async function evaluateTrustPolicy(
  prisma: TrustPolicyEvaluatorClient,
  input: EvaluateTrustPolicyInput,
): Promise<EvaluateTrustPolicyResult> {
  const now = new Date();
  const activeCredentials = await prisma.trustCredential.findMany({
    where: {
      identityId: input.identityId,
      status: TrustCredentialStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      credentialType: {
        select: {
          code: true,
        },
      },
    },
  });

  const activeCredentialTypes = new Set(
    activeCredentials.map((credential) => credential.credentialType.code),
  );
  const requiredCredentialTypes = Array.from(new Set(input.requiredCredentialTypes));
  const satisfiedCredentialTypes = requiredCredentialTypes.filter((credentialType) =>
    activeCredentialTypes.has(credentialType),
  );
  const missingCredentialTypes = requiredCredentialTypes.filter(
    (credentialType) => !activeCredentialTypes.has(credentialType),
  );

  return {
    allowed: missingCredentialTypes.length === 0,
    satisfiedCredentialTypes,
    missingCredentialTypes,
  };
}

export function explainTrustPolicyEvaluation(result: EvaluateTrustPolicyResult): string {
  if (result.allowed) {
    return "Identity satisfies all required credential types.";
  }

  return `Missing credential types: ${result.missingCredentialTypes.join(", ")}`;
}
