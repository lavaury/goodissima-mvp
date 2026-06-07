import { NextResponse } from "next/server";
import { CredentialTypeStatus, Prisma } from "@prisma/client";

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";

type AdmissionMode = "OPEN" | "VERIFIED_ONLY";

function isVerifiedLinkUiEnabled() {
  return process.env.TRUST_ADMISSION_VERIFIED_LINK_UI_ENABLED === "true";
}

function getPilotGLinkIds() {
  return (process.env.TRUST_ADMISSION_PILOT_GLINK_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAdmissionMode(value: unknown): AdmissionMode | null {
  return value === "OPEN" || value === "VERIFIED_ONLY" ? value : null;
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

async function ensureActiveGLinkTrustPolicy(tx: Prisma.TransactionClient, gLinkId: string) {
  const existingPolicy = await tx.trustPolicy.findFirst({
    where: {
      scope: "GLINK",
      gLinkId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existingPolicy) return existingPolicy;

  return tx.trustPolicy.create({
    data: {
      scope: "GLINK",
      gLinkId,
      status: "ACTIVE",
      reason: "Trust admission pilot - owner admission setting",
      version: 1,
    },
    select: { id: true },
  });
}

export async function POST(req: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const body = await req.json();
  const mode = parseAdmissionMode(body.mode);

  if (!mode) {
    return NextResponse.json({ error: "Invalid admission mode" }, { status: 400 });
  }

  if (!isVerifiedLinkUiEnabled()) {
    return NextResponse.json({ error: "Verified admission link UI disabled" }, { status: 403 });
  }

  const gLink = await prisma.gLink.findUnique({
    where: { id: params.linkId },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!gLink) {
    return NextResponse.json({ error: "GLink not found" }, { status: 404 });
  }

  if (gLink.ownerId !== owner.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!getPilotGLinkIds().includes(gLink.id)) {
    return NextResponse.json({ error: "GLink is not enabled for Trust Admission pilot" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    const trustPolicy = await ensureActiveGLinkTrustPolicy(tx, gLink.id);

    if (mode === "OPEN") {
      await tx.trustPolicyCredentialRequirement.deleteMany({
        where: { trustPolicyId: trustPolicy.id },
      });
      return;
    }

    const credentialType = await ensureVerifiedIdentityCredentialType(tx);

    await tx.trustPolicyCredentialRequirement.upsert({
      where: {
        trustPolicyId_credentialTypeId: {
          trustPolicyId: trustPolicy.id,
          credentialTypeId: credentialType.id,
        },
      },
      update: {},
      create: {
        trustPolicyId: trustPolicy.id,
        credentialTypeId: credentialType.id,
      },
    });
  });

  console.info("[trust-admission] GLink admission setting updated", {
    gLinkId: gLink.id,
    ownerId: owner.id,
    mode,
  });

  return NextResponse.json({
    linkId: gLink.id,
    mode,
  });
}
