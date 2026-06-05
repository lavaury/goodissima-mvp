import {
  CredentialTypeStatus,
  IdentityStatus,
  IdentityType,
  PrismaClient,
  TrustedOrganizationStatus,
  TrustClaimType,
  TrustCredentialStatus,
} from "@prisma/client";

import { issueTrustCredential } from "../lib/trust-credentials";
import {
  evaluateTrustPolicy,
  explainTrustPolicyEvaluation,
} from "../lib/trust-policy-evaluator";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const BANK_CUSTOMER = "BANK_CUSTOMER";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust policy evaluator demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this may write demo trust data.",
      ].join(" "),
    );
  }
}

async function ensureVerifiedIdentityCredentialType() {
  return prisma.credentialType.upsert({
    where: { code: VERIFIED_IDENTITY },
    update: {
      name: "Identite verifiee",
      status: CredentialTypeStatus.ACTIVE,
    },
    create: {
      code: VERIFIED_IDENTITY,
      name: "Identite verifiee",
      status: CredentialTypeStatus.ACTIVE,
    },
  });
}

async function ensureDemoTrustedOrganization() {
  const existingOrganization = await prisma.trustedOrganization.findFirst({
    where: { organizationId: DEMO_ISSUER_ORGANIZATION_ID },
    orderBy: { createdAt: "asc" },
  });

  if (existingOrganization) {
    return prisma.trustedOrganization.update({
      where: { id: existingOrganization.id },
      data: {
        status: TrustedOrganizationStatus.TRUSTED,
        reason: "Demo authority for trust framework validation",
      },
    });
  }

  return prisma.trustedOrganization.create({
    data: {
      organizationId: DEMO_ISSUER_ORGANIZATION_ID,
      status: TrustedOrganizationStatus.TRUSTED,
      reason: "Demo authority for trust framework validation",
      approvedAt: new Date(),
    },
  });
}

async function findReusableDemoIdentity() {
  const activeDemoCredential = await prisma.trustCredential.findFirst({
    where: {
      status: TrustCredentialStatus.ACTIVE,
      credentialType: { code: VERIFIED_IDENTITY },
      issuerTrustedOrganization: {
        organizationId: DEMO_ISSUER_ORGANIZATION_ID,
      },
    },
    orderBy: { issuedAt: "desc" },
    select: {
      identity: true,
    },
  });

  return activeDemoCredential?.identity ?? null;
}

async function createDemoIdentityWithVerifiedCredential() {
  const [credentialType, trustedOrganization] = await Promise.all([
    ensureVerifiedIdentityCredentialType(),
    ensureDemoTrustedOrganization(),
  ]);
  const identity = await prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });

  await issueTrustCredential(prisma, {
    identityId: identity.id,
    credentialTypeId: credentialType.id,
    issuerTrustedOrganizationId: trustedOrganization.id,
    claims: [
      {
        claimKey: "identityVerified",
        claimType: TrustClaimType.BOOLEAN,
        claimValue: true,
      },
      {
        claimKey: "country",
        claimType: TrustClaimType.STRING,
        claimValue: "FR",
      },
      {
        claimKey: "verificationLevel",
        claimType: TrustClaimType.STRING,
        claimValue: "HIGH",
      },
      {
        claimKey: "verifiedAt",
        claimType: TrustClaimType.DATETIME,
        claimValue: new Date().toISOString(),
      },
    ],
  });

  return identity;
}

async function evaluateDemoCase(identityId: string, requiredCredentialTypes: string[]) {
  const result = await evaluateTrustPolicy(prisma, {
    identityId,
    requiredCredentialTypes,
  });

  return {
    requiredCredentialTypes,
    expected: result.allowed ? "ALLOWED" : "DENIED",
    result,
    explanation: explainTrustPolicyEvaluation(result),
  };
}

async function main() {
  assertDemoScriptAllowed();

  await Promise.all([ensureVerifiedIdentityCredentialType(), ensureDemoTrustedOrganization()]);

  const reusableIdentity = await findReusableDemoIdentity();
  const identity = reusableIdentity ?? (await createDemoIdentityWithVerifiedCredential());

  const cases = await Promise.all([
    evaluateDemoCase(identity.id, [VERIFIED_IDENTITY]),
    evaluateDemoCase(identity.id, [VERIFIED_IDENTITY, BANK_CUSTOMER]),
  ]);

  console.log("DEMO / STAGING ONLY - TrustPolicy evaluator results.");
  console.log(
    JSON.stringify(
      {
        identityId: identity.id,
        reusedExistingDemoIdentity: reusableIdentity !== null,
        cases,
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
