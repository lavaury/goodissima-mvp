import {
  CredentialTypeStatus,
  IdentityStatus,
  IdentityType,
  PrismaClient,
  TrustedOrganizationStatus,
  TrustClaimType,
} from "@prisma/client";

import { createTrustAdmissionToken } from "../lib/trust-admission-tokens";
import { issueTrustCredential } from "../lib/trust-credentials";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust admission link demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo trust data.",
      ].join(" "),
    );
  }
}

function getPilotGLinkId() {
  const gLinkId = process.env.TRUST_ADMISSION_PILOT_GLINK_ID?.trim();

  if (!gLinkId) {
    throw new Error("TRUST_ADMISSION_PILOT_GLINK_ID is required.");
  }

  return gLinkId;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

function createAdmissionUrl(input: { slug: string; token: string }) {
  return `${getAppUrl()}/l/${encodeURIComponent(input.slug)}?trustAdmissionToken=${encodeURIComponent(input.token)}`;
}

function createTokenPreview(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function shouldIncludeVerifiedIdentityCredential() {
  return process.env.TRUST_ADMISSION_LINK_INCLUDE_VERIFIED_IDENTITY === "true";
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

async function maybeIssueVerifiedIdentityCredential(identityId: string) {
  if (!shouldIncludeVerifiedIdentityCredential()) {
    return {
      verifiedIdentityCredentialIssued: false,
      verifiedIdentityCredentialId: null,
    };
  }

  const [credentialType, trustedOrganization] = await Promise.all([
    ensureVerifiedIdentityCredentialType(),
    ensureDemoTrustedOrganization(),
  ]);
  const verifiedAt = new Date().toISOString();
  const credential = await issueTrustCredential(prisma, {
    identityId,
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

  return {
    verifiedIdentityCredentialIssued: true,
    verifiedIdentityCredentialId: credential.id,
  };
}

async function main() {
  assertDemoScriptAllowed();

  const gLinkId = getPilotGLinkId();
  const gLink = await prisma.gLink.findUnique({
    where: { id: gLinkId },
    select: {
      id: true,
      title: true,
      slug: true,
    },
  });

  if (!gLink) {
    throw new Error(`GLink not found: ${gLinkId}`);
  }

  const identity = await prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });
  const verifiedIdentityCredential = await maybeIssueVerifiedIdentityCredential(identity.id);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const createdToken = await createTrustAdmissionToken(prisma, {
    identityId: identity.id,
    gLinkId: gLink.id,
    expiresAt,
  });

  console.log("DEMO / STAGING ONLY - Trust admission link created.");
  console.log(
    JSON.stringify(
      {
        gLinkId: gLink.id,
        slug: gLink.slug,
        title: gLink.title,
        identityId: identity.id,
        tokenId: createdToken.tokenId,
        tokenPreview: createTokenPreview(createdToken.token),
        expiresAt: createdToken.expiresAt,
        verifiedIdentityCredentialIssued:
          verifiedIdentityCredential.verifiedIdentityCredentialIssued,
        verifiedIdentityCredentialId:
          verifiedIdentityCredential.verifiedIdentityCredentialId,
        admissionUrl: createAdmissionUrl({
          slug: gLink.slug,
          token: createdToken.token,
        }),
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
