import { CredentialTypeStatus, PrismaClient } from "@prisma/client";

import {
  describeCredentialRequirements,
  hasCredentialRequirements,
  resolveRequiredCredentialTypesForTrustPolicy,
} from "../lib/trust-policy-requirements";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const BANK_CUSTOMER = "BANK_CUSTOMER";
const DEMO_POLICY_REASON = "Demo trust policy credential requirements resolver";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust policy requirements demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo trust data.",
      ].join(" "),
    );
  }
}

async function ensureCredentialType(input: { code: string; name: string }) {
  return prisma.credentialType.upsert({
    where: { code: input.code },
    update: {
      name: input.name,
      status: CredentialTypeStatus.ACTIVE,
    },
    create: {
      code: input.code,
      name: input.name,
      status: CredentialTypeStatus.ACTIVE,
    },
  });
}

async function ensureDemoTrustPolicy() {
  const existingPolicy = await prisma.trustPolicy.findFirst({
    where: {
      scope: "TEMPLATE",
      reason: DEMO_POLICY_REASON,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingPolicy) {
    return prisma.trustPolicy.update({
      where: { id: existingPolicy.id },
      data: {
        status: "ACTIVE",
        reason: DEMO_POLICY_REASON,
      },
    });
  }

  return prisma.trustPolicy.create({
    data: {
      scope: "TEMPLATE",
      status: "ACTIVE",
      reason: DEMO_POLICY_REASON,
      version: 1,
    },
  });
}

async function ensureRequirement(input: { trustPolicyId: string; credentialTypeId: string }) {
  return prisma.trustPolicyCredentialRequirement.upsert({
    where: {
      trustPolicyId_credentialTypeId: {
        trustPolicyId: input.trustPolicyId,
        credentialTypeId: input.credentialTypeId,
      },
    },
    update: {},
    create: {
      trustPolicyId: input.trustPolicyId,
      credentialTypeId: input.credentialTypeId,
    },
  });
}

async function main() {
  assertDemoScriptAllowed();

  const [verifiedIdentity, bankCustomer, trustPolicy] = await Promise.all([
    ensureCredentialType({ code: VERIFIED_IDENTITY, name: "Identite verifiee" }),
    ensureCredentialType({ code: BANK_CUSTOMER, name: "Client bancaire" }),
    ensureDemoTrustPolicy(),
  ]);

  await Promise.all([
    ensureRequirement({
      trustPolicyId: trustPolicy.id,
      credentialTypeId: verifiedIdentity.id,
    }),
    ensureRequirement({
      trustPolicyId: trustPolicy.id,
      credentialTypeId: bankCustomer.id,
    }),
  ]);

  const summary = await resolveRequiredCredentialTypesForTrustPolicy(prisma, trustPolicy.id);
  const hasRequirements = await hasCredentialRequirements(prisma, trustPolicy.id);

  console.log("DEMO / STAGING ONLY - TrustPolicy credential requirements resolved.");
  console.log(
    JSON.stringify(
      {
        trustPolicyId: trustPolicy.id,
        hasRequirements,
        summary,
        description: describeCredentialRequirements(summary),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
