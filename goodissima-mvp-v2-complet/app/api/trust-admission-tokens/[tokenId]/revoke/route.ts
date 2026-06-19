import { NextResponse } from "next/server";
import { TrustAdmissionTokenStatus } from "@prisma/client";

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeTrustAdmissionToken } from "@/lib/trust-admission-tokens";

function isVerifiedLinkUiEnabled() {
  return process.env.TRUST_ADMISSION_VERIFIED_LINK_UI_ENABLED === "true";
}

function getPilotGLinkIds() {
  return (process.env.TRUST_ADMISSION_PILOT_GLINK_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(_req: Request, { params }: { params: { tokenId: string } }) {
  const owner = await getCurrentPrismaUser();

  if (!isVerifiedLinkUiEnabled()) {
    return NextResponse.json({ error: "Verified admission link UI disabled" }, { status: 403 });
  }

  const token = await prisma.trustAdmissionToken.findUnique({
    where: { id: params.tokenId },
    select: {
      id: true,
      gLinkId: true,
      status: true,
      gLink: {
        select: {
          id: true,
          ownerId: true,
        },
      },
    },
  });

  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (!token.gLinkId || !token.gLink) {
    return NextResponse.json({ error: "Token is not linked to a GLink" }, { status: 400 });
  }

  if (token.gLink.ownerId !== owner.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!getPilotGLinkIds().includes(token.gLink.id)) {
    return NextResponse.json({ error: "GLink is not enabled for Trust Admission pilot" }, { status: 403 });
  }

  if (token.status !== TrustAdmissionTokenStatus.ACTIVE) {
    return NextResponse.json({ error: "Only active tokens can be revoked" }, { status: 409 });
  }

  const revoked = await revokeTrustAdmissionToken(prisma, token.id);

  console.info("[trust-admission-token] Verified pilot link revoked", {
    gLinkId: token.gLink.id,
    ownerId: owner.id,
    tokenId: revoked.id,
  });

  return NextResponse.json({
    tokenId: revoked.id,
    status: revoked.status,
  });
}
