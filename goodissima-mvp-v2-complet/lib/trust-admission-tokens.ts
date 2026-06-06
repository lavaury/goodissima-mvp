import { createHash, randomBytes } from "crypto";
import {
  TrustAdmissionTokenPurpose,
  TrustAdmissionTokenStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

export type TrustAdmissionTokenClient = Prisma.TransactionClient | PrismaClient;

export type CreateTrustAdmissionTokenInput = {
  identityId: string;
  gLinkId?: string | null;
  expiresAt: Date;
};

export type CreateTrustAdmissionTokenResult = {
  token: string;
  tokenId: string;
  identityId: string;
  expiresAt: Date;
};

export type ResolveTrustAdmissionTokenInput = {
  token: string;
  gLinkId?: string | null;
};

export type TrustAdmissionTokenResolution = {
  resolved: boolean;
  identityId: string | null;
  tokenId: string | null;
  reasons: string[];
};

function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

function hashTrustAdmissionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createTrustAdmissionToken(
  prisma: TrustAdmissionTokenClient,
  input: CreateTrustAdmissionTokenInput,
): Promise<CreateTrustAdmissionTokenResult> {
  const token = createOpaqueToken();
  const createdToken = await prisma.trustAdmissionToken.create({
    data: {
      tokenHash: hashTrustAdmissionToken(token),
      identityId: input.identityId,
      gLinkId: input.gLinkId ?? null,
      purpose: TrustAdmissionTokenPurpose.TRUST_ADMISSION,
      status: TrustAdmissionTokenStatus.ACTIVE,
      expiresAt: input.expiresAt,
    },
    select: {
      id: true,
      identityId: true,
      expiresAt: true,
    },
  });

  return {
    token,
    tokenId: createdToken.id,
    identityId: createdToken.identityId,
    expiresAt: createdToken.expiresAt,
  };
}

export async function resolveTrustAdmissionToken(
  prisma: TrustAdmissionTokenClient,
  input: ResolveTrustAdmissionTokenInput,
  now = new Date(),
): Promise<TrustAdmissionTokenResolution> {
  const token = input.token.trim();

  if (!token) {
    return {
      resolved: false,
      identityId: null,
      tokenId: null,
      reasons: ["TOKEN_NOT_FOUND"],
    };
  }

  const storedToken = await prisma.trustAdmissionToken.findUnique({
    where: { tokenHash: hashTrustAdmissionToken(token) },
    select: {
      id: true,
      identityId: true,
      gLinkId: true,
      purpose: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!storedToken) {
    return {
      resolved: false,
      identityId: null,
      tokenId: null,
      reasons: ["TOKEN_NOT_FOUND"],
    };
  }

  const reasons: string[] = [];

  if (
    storedToken.status !== TrustAdmissionTokenStatus.ACTIVE ||
    storedToken.purpose !== TrustAdmissionTokenPurpose.TRUST_ADMISSION
  ) {
    reasons.push("TOKEN_NOT_ACTIVE");
  }

  if (storedToken.expiresAt <= now) {
    reasons.push("TOKEN_EXPIRED");
  }

  if (input.gLinkId && storedToken.gLinkId && storedToken.gLinkId !== input.gLinkId) {
    reasons.push("TOKEN_GLINK_MISMATCH");
  }

  if (reasons.length > 0) {
    return {
      resolved: false,
      identityId: null,
      tokenId: storedToken.id,
      reasons,
    };
  }

  return {
    resolved: true,
    identityId: storedToken.identityId,
    tokenId: storedToken.id,
    reasons: ["TOKEN_RESOLVED"],
  };
}

export async function markTrustAdmissionTokenUsed(
  prisma: TrustAdmissionTokenClient,
  tokenId: string,
  usedAt = new Date(),
) {
  return prisma.trustAdmissionToken.update({
    where: { id: tokenId },
    data: {
      status: TrustAdmissionTokenStatus.USED,
      usedAt,
    },
  });
}

export async function revokeTrustAdmissionToken(
  prisma: TrustAdmissionTokenClient,
  tokenId: string,
) {
  return prisma.trustAdmissionToken.update({
    where: { id: tokenId },
    data: {
      status: TrustAdmissionTokenStatus.REVOKED,
    },
  });
}
