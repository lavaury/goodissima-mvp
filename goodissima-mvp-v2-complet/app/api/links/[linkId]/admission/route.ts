import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { CredentialTypeStatus, Prisma } from "@prisma/client";

import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSecureLinkAdmissionMode } from "@/lib/secure-link-admission";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";

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
      requireCandidateEmail: false,
      reason: "Secure link admission setting",
      version: 1,
    },
    select: { id: true },
  });
}

export async function POST(req: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const body = await req.json();
  const mode = parseSecureLinkAdmissionMode(body.mode);

  if (body.mode !== "OPEN" && body.mode !== "VERIFIED_ONLY") {
    return NextResponse.json({ error: "Invalid admission mode" }, { status: 400 });
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

  await prisma.$transaction(async (tx) => {
    await tx.gLink.update({
      where: { id: gLink.id },
      data: { admissionMode: mode },
    });
    const trustPolicy = await ensureActiveGLinkTrustPolicy(tx, gLink.id);
    await tx.trustPolicy.update({
      where: { id: trustPolicy.id },
      data: { requireCandidateEmail: false },
    });

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

  revalidatePath(`/links/${gLink.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/opportunities");

  return NextResponse.json({
    linkId: gLink.id,
    mode,
  });
}
