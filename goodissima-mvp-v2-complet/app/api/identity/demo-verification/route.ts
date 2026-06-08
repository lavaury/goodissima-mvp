import { NextResponse } from "next/server";
import {
  CredentialTypeStatus,
  IdentityStatus,
  Prisma,
  TrustedOrganizationStatus,
  TrustClaimType,
  TrustCredentialStatus,
} from "@prisma/client";

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueTrustCredentialInTransaction } from "@/lib/trust-credentials";
import { getOrCreateGoodissimaIdentityForUser } from "@/lib/user-identity";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";

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
        reason: "Demo authority for user identity verification",
      },
    });
  }

  return tx.trustedOrganization.create({
    data: {
      organizationId: DEMO_ISSUER_ORGANIZATION_ID,
      status: TrustedOrganizationStatus.TRUSTED,
      reason: "Demo authority for user identity verification",
      approvedAt: new Date(),
    },
  });
}

export async function POST() {
  const currentUser = await getCurrentPrismaUser();
  const identityLink = await getOrCreateGoodissimaIdentityForUser(prisma, {
    userId: currentUser.id,
  });

  const result = await prisma.$transaction(async (tx) => {
    const [credentialType, trustedOrganization] = await Promise.all([
      ensureVerifiedIdentityCredentialType(tx),
      ensureDemoTrustedOrganization(tx),
    ]);

    const existingVerifiedCredential = await tx.trustCredential.findFirst({
      where: {
        identityId: identityLink.identityId,
        status: TrustCredentialStatus.ACTIVE,
        credentialType: {
          code: VERIFIED_IDENTITY,
        },
      },
      select: { id: true },
    });

    let credentialIssued = false;

    if (!existingVerifiedCredential) {
      await issueTrustCredentialInTransaction(tx, {
        identityId: identityLink.identityId,
        credentialTypeId: credentialType.id,
        issuerTrustedOrganizationId: trustedOrganization.id,
        claims: [
          {
            claimKey: "identityVerified",
            claimType: TrustClaimType.BOOLEAN,
            claimValue: true,
          },
          {
            claimKey: "verificationSource",
            claimType: TrustClaimType.STRING,
            claimValue: DEMO_ISSUER_ORGANIZATION_ID,
          },
          {
            claimKey: "verificationMode",
            claimType: TrustClaimType.STRING,
            claimValue: "DEMO_ONLY",
          },
          {
            claimKey: "verifiedAt",
            claimType: TrustClaimType.DATETIME,
            claimValue: new Date().toISOString(),
          },
        ],
      });
      credentialIssued = true;
    }

    await tx.goodissimaIdentity.update({
      where: { id: identityLink.identityId },
      data: { status: IdentityStatus.VERIFIED },
      select: { id: true },
    });

    return {
      identityStatus: IdentityStatus.VERIFIED,
      credentialIssued,
    };
  });

  console.info("[identity-demo-verification] User identity verified by demo authority", {
    userId: currentUser.id,
    credentialIssued: result.credentialIssued,
  });

  return NextResponse.json(result);
}
