import { NextResponse } from "next/server";
import { TrustCredentialStatus } from "@prisma/client";

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeTrustCredential } from "@/lib/trust-credentials";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";
const DEMO_REVOCATION_REASON = "Revoked by identity owner (demo)";

export async function POST() {
  if (process.env.NODE_ENV === "production" || process.env.GOODISSIMA_ENV === "production" || process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const currentUser = await getCurrentPrismaUser();

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { goodissimaIdentityId: true },
  });

  if (!user?.goodissimaIdentityId) {
    return NextResponse.json({ error: "Goodissima identity not found" }, { status: 404 });
  }

  const now = new Date();
  const activeCredential = await prisma.trustCredential.findFirst({
    where: {
      identityId: user.goodissimaIdentityId,
      status: TrustCredentialStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      credentialType: { code: VERIFIED_IDENTITY },
      issuerTrustedOrganization: { organizationId: DEMO_ISSUER_ORGANIZATION_ID },
    },
    orderBy: { issuedAt: "desc" },
    select: { id: true },
  });

  if (activeCredential) {
    const revoked = await revokeTrustCredential(prisma, {
      credentialId: activeCredential.id,
      revocationReason: DEMO_REVOCATION_REASON,
    });

    return NextResponse.json({
      success: true,
      credentialId: revoked.id,
      status: revoked.status,
      alreadyRevoked: false,
    });
  }

  const revokedCredential = await prisma.trustCredential.findFirst({
    where: {
      identityId: user.goodissimaIdentityId,
      status: TrustCredentialStatus.REVOKED,
      credentialType: { code: VERIFIED_IDENTITY },
      issuerTrustedOrganization: { organizationId: DEMO_ISSUER_ORGANIZATION_ID },
    },
    orderBy: { revokedAt: "desc" },
    select: { id: true, status: true },
  });

  if (revokedCredential) {
    return NextResponse.json({
      success: true,
      credentialId: revokedCredential.id,
      status: revokedCredential.status,
      alreadyRevoked: true,
    });
  }

  return NextResponse.json({ error: "Active demo credential not found" }, { status: 404 });
}
