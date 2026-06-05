import {
  CredentialTypeStatus,
  IdentityStatus,
  IdentityType,
  Prisma,
  PrismaClient,
  TrustedOrganizationStatus,
  TrustClaimType,
} from "@prisma/client";

import {
  getActiveCredentialsForIdentity,
  getClaimsForCredential,
  issueTrustCredential,
} from "../lib/trust-credentials";

const DEMO_CREDENTIAL_TYPE_CODE = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust credential demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo trust data.",
      ].join(" "),
    );
  }
}

async function ensureCredentialType() {
  return prisma.credentialType.upsert({
    where: { code: DEMO_CREDENTIAL_TYPE_CODE },
    update: {
      name: "Identité vérifiée",
      status: CredentialTypeStatus.ACTIVE,
    },
    create: {
      code: DEMO_CREDENTIAL_TYPE_CODE,
      name: "Identité vérifiée",
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

async function createDemoIdentity() {
  return prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });
}

async function main() {
  assertDemoScriptAllowed();

  const credentialType = await ensureCredentialType();
  const trustedOrganization = await ensureDemoTrustedOrganization();

  // GoodissimaIdentity has no stable demo email/name field yet, so each run creates
  // a fresh demo identity and credential while reusing stable reference data.
  const identity = await createDemoIdentity();
  const verifiedAt = new Date().toISOString();

  const issuedCredential = await issueTrustCredential(prisma, {
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
        claimValue: verifiedAt,
      },
    ],
  });

  const activeCredentials = await getActiveCredentialsForIdentity(prisma, identity.id);

  const demoOutput = await Promise.all(
    activeCredentials.map(async (credential) => {
      const claims = await getClaimsForCredential(prisma, credential.id);

      return {
        identityId: credential.identityId,
        credentialId: credential.id,
        credentialType: credential.credentialType.code,
        issuer: credential.issuerTrustedOrganization.organizationId,
        status: credential.status,
        claims: Object.fromEntries(
          claims.map((claim) => [claim.claimKey, claim.claimValue as Prisma.JsonValue]),
        ),
      };
    }),
  );

  console.log("DEMO / STAGING ONLY - TrustCredential issued and reloaded.");
  console.log(
    JSON.stringify(
      {
        demoIdentityCreatedEachRun: true,
        issuedCredentialId: issuedCredential.id,
        activeCredentials: demoOutput,
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
