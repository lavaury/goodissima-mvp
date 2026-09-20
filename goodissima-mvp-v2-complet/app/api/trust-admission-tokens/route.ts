import { NextResponse } from "next/server";
import {
  CredentialTypeStatus,
  IdentityStatus,
  IdentityType,
  Prisma,
  TrustedOrganizationStatus,
  TrustClaimType,
} from "@prisma/client";

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTrustAdmissionToken } from "@/lib/trust-admission-tokens";
import { issueTrustCredentialInTransaction } from "@/lib/trust-credentials";
import { buildPublicAppUrl } from "@/lib/public-app-url";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function createAdmissionUrl(input: { slug: string; token: string }) {
  const url = new URL(buildPublicAppUrl(`/l/${encodeURIComponent(input.slug)}`));
  url.searchParams.set("trustAdmissionToken", input.token);
  return url.toString();
}

function isVerifiedLinkUiEnabled() {
  return process.env.TRUST_ADMISSION_VERIFIED_LINK_UI_ENABLED === "true";
}

function getPilotGLinkIds() {
  return (process.env.TRUST_ADMISSION_PILOT_GLINK_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function ensureVerifiedIdentityCredentialType(tx: Prisma.TransactionClient) {
  return tx.credentialType.upsert({
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

async function ensureDemoTrustedOrganization(tx: Prisma.TransactionClient) {
  const existingOrganization = await tx.trustedOrganization.findFirst({
    where: { organizationId: DEMO_ISSUER_ORGANIZATION_ID },
    orderBy: { createdAt: "asc" },
  });

  if (existingOrganization) {
    return tx.trustedOrganization.update({
      where: { id: existingOrganization.id },
      data: {
        status: TrustedOrganizationStatus.TRUSTED,
        reason: "Demo authority for verified admission link pilot",
      },
    });
  }

  return tx.trustedOrganization.create({
    data: {
      organizationId: DEMO_ISSUER_ORGANIZATION_ID,
      status: TrustedOrganizationStatus.TRUSTED,
      reason: "Demo authority for verified admission link pilot",
      approvedAt: new Date(),
    },
  });
}

export async function POST(req: Request) {
  const owner = await getCurrentPrismaUser();
  const body = await req.json();
  const gLinkId = typeof body.gLinkId === "string" ? body.gLinkId.trim() : "";

  if (!gLinkId) {
    return NextResponse.json({ error: "gLinkId required" }, { status: 400 });
  }

  const gLink = await prisma.gLink.findUnique({
    where: { id: gLinkId },
    select: {
      id: true,
      ownerId: true,
      slug: true,
    },
  });

  if (!gLink) {
    return NextResponse.json({ error: "GLink not found" }, { status: 404 });
  }

  if (gLink.ownerId !== owner.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isVerifiedLinkUiEnabled()) {
    return NextResponse.json({ error: "Verified admission link UI disabled" }, { status: 403 });
  }

  if (!getPilotGLinkIds().includes(gLink.id)) {
    return NextResponse.json({ error: "GLink is not enabled for Trust Admission pilot" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const createdToken = await prisma.$transaction(async (tx) => {
    const [credentialType, trustedOrganization] = await Promise.all([
      ensureVerifiedIdentityCredentialType(tx),
      ensureDemoTrustedOrganization(tx),
    ]);

    // Pilot/demo only: this marks the synthetic admission identity as VERIFIED.
    // This is not a production KYC or real-world identity verification workflow.
    const identity = await tx.goodissimaIdentity.create({
      data: {
        type: IdentityType.PERSON,
        status: IdentityStatus.VERIFIED,
      },
    });

    await issueTrustCredentialInTransaction(tx, {
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

    return createTrustAdmissionToken(tx, {
      identityId: identity.id,
      gLinkId: gLink.id,
      expiresAt,
    });
  });

  console.info("[trust-admission-token] Verified pilot link created", {
    gLinkId: gLink.id,
    ownerId: owner.id,
    tokenId: createdToken.tokenId,
    expiresAt: createdToken.expiresAt,
  });

  return NextResponse.json({
    tokenId: createdToken.tokenId,
    admissionUrl: createAdmissionUrl({
      slug: gLink.slug,
      token: createdToken.token,
    }),
    expiresAt: createdToken.expiresAt,
    status: "ACTIVE",
  });
}
