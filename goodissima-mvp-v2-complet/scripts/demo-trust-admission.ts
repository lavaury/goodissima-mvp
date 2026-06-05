import {
  CredentialTypeStatus,
  IdentityStatus,
  IdentityType,
  PrismaClient,
  TrustedOrganizationStatus,
  TrustClaimType,
  TrustCredentialStatus,
} from "@prisma/client";

import { evaluateTrustAdmission, explainTrustAdmissionEvaluation } from "../lib/trust-admission";
import { issueTrustCredential } from "../lib/trust-credentials";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const BANK_CUSTOMER = "BANK_CUSTOMER";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";
const NO_REQUIREMENTS_REASON = "Demo trust admission no credential requirements";
const VERIFIED_ONLY_REASON = "Demo trust admission requires verified identity";
const VERIFIED_AND_BANK_REASON = "Demo trust admission requires verified identity and bank customer";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust admission demo script.",
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

async function ensureDemoPolicy(reason: string) {
  const existingPolicy = await prisma.trustPolicy.findFirst({
    where: {
      scope: "TEMPLATE",
      reason,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingPolicy) {
    return prisma.trustPolicy.update({
      where: { id: existingPolicy.id },
      data: {
        status: "ACTIVE",
        reason,
      },
    });
  }

  return prisma.trustPolicy.create({
    data: {
      scope: "TEMPLATE",
      status: "ACTIVE",
      reason,
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

async function ensureVerifiedIdentityCredential(input: {
  identityId: string;
  credentialTypeId: string;
  issuerTrustedOrganizationId: string;
}) {
  const existingCredential = await prisma.trustCredential.findFirst({
    where: {
      identityId: input.identityId,
      credentialTypeId: input.credentialTypeId,
      issuerTrustedOrganizationId: input.issuerTrustedOrganizationId,
      status: TrustCredentialStatus.ACTIVE,
    },
    orderBy: { issuedAt: "desc" },
  });

  if (existingCredential) {
    return existingCredential;
  }

  return issueTrustCredential(prisma, {
    identityId: input.identityId,
    credentialTypeId: input.credentialTypeId,
    issuerTrustedOrganizationId: input.issuerTrustedOrganizationId,
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
}

async function evaluateDemoCase(input: {
  label: string;
  trustPolicyId: string;
  candidateIdentityId?: string | null;
}) {
  const result = await evaluateTrustAdmission(prisma, {
    trustPolicyId: input.trustPolicyId,
    candidateIdentityId: input.candidateIdentityId,
  });

  return {
    label: input.label,
    result,
    explanation: explainTrustAdmissionEvaluation(result),
  };
}

async function main() {
  assertDemoScriptAllowed();

  const [verifiedIdentity, bankCustomer, trustedOrganization] = await Promise.all([
    ensureCredentialType({ code: VERIFIED_IDENTITY, name: "Identite verifiee" }),
    ensureCredentialType({ code: BANK_CUSTOMER, name: "Client bancaire" }),
    ensureDemoTrustedOrganization(),
  ]);

  const [noRequirementsPolicy, verifiedOnlyPolicy, verifiedAndBankPolicy] = await Promise.all([
    ensureDemoPolicy(NO_REQUIREMENTS_REASON),
    ensureDemoPolicy(VERIFIED_ONLY_REASON),
    ensureDemoPolicy(VERIFIED_AND_BANK_REASON),
  ]);

  await Promise.all([
    ensureRequirement({
      trustPolicyId: verifiedOnlyPolicy.id,
      credentialTypeId: verifiedIdentity.id,
    }),
    ensureRequirement({
      trustPolicyId: verifiedAndBankPolicy.id,
      credentialTypeId: verifiedIdentity.id,
    }),
    ensureRequirement({
      trustPolicyId: verifiedAndBankPolicy.id,
      credentialTypeId: bankCustomer.id,
    }),
  ]);

  const identity = await prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });

  await ensureVerifiedIdentityCredential({
    identityId: identity.id,
    credentialTypeId: verifiedIdentity.id,
    issuerTrustedOrganizationId: trustedOrganization.id,
  });

  const cases = await Promise.all([
    evaluateDemoCase({
      label: "Case A - no requirements and no candidate identity",
      trustPolicyId: noRequirementsPolicy.id,
      candidateIdentityId: null,
    }),
    evaluateDemoCase({
      label: "Case B - verified identity requirement satisfied",
      trustPolicyId: verifiedOnlyPolicy.id,
      candidateIdentityId: identity.id,
    }),
    evaluateDemoCase({
      label: "Case C - bank customer requirement missing",
      trustPolicyId: verifiedAndBankPolicy.id,
      candidateIdentityId: identity.id,
    }),
  ]);

  console.log("DEMO / STAGING ONLY - Trust admission evaluation results.");
  console.log(
    JSON.stringify(
      {
        candidateIdentityId: identity.id,
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
