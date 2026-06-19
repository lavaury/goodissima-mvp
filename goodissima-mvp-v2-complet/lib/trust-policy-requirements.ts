import type { Prisma, PrismaClient } from "@prisma/client";

export type TrustPolicyRequirementsClient = Prisma.TransactionClient | PrismaClient;

export type TrustPolicyRequirementSummary = {
  credentialTypeIds: string[];
  credentialTypeCodes: string[];
};

export async function resolveRequiredCredentialTypesForTrustPolicy(
  prisma: TrustPolicyRequirementsClient,
  trustPolicyId: string,
): Promise<TrustPolicyRequirementSummary> {
  const requirements = await prisma.trustPolicyCredentialRequirement.findMany({
    where: { trustPolicyId },
    orderBy: {
      credentialType: {
        code: "asc",
      },
    },
    include: {
      credentialType: {
        select: {
          id: true,
          code: true,
        },
      },
    },
  });

  const credentialTypeIds = Array.from(
    new Set(requirements.map((requirement) => requirement.credentialType.id)),
  ).sort();
  const credentialTypeCodes = Array.from(
    new Set(requirements.map((requirement) => requirement.credentialType.code)),
  ).sort();

  return {
    credentialTypeIds,
    credentialTypeCodes,
  };
}

export async function hasCredentialRequirements(
  prisma: TrustPolicyRequirementsClient,
  trustPolicyId: string,
): Promise<boolean> {
  const requirementCount = await prisma.trustPolicyCredentialRequirement.count({
    where: { trustPolicyId },
    take: 1,
  });

  return requirementCount > 0;
}

export function describeCredentialRequirements(summary: TrustPolicyRequirementSummary): string {
  if (summary.credentialTypeCodes.length === 0) {
    return "No credential requirements.";
  }

  return `Requires: ${summary.credentialTypeCodes.join(", ")}`;
}
