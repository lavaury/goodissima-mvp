import {
  Prisma,
  TrustClaimType,
  TrustCredentialStatus,
  type PrismaClient,
} from "@prisma/client";

export type TrustCredentialServiceClient = Pick<PrismaClient, "$transaction">;

export type IssueTrustClaimInput = {
  claimKey: string;
  claimType: TrustClaimType;
  claimValue: Prisma.InputJsonValue;
};

export type IssueTrustCredentialInput = {
  identityId: string;
  credentialTypeId: string;
  issuerTrustedOrganizationId: string;
  issuedAt?: Date;
  expiresAt?: Date | null;
  claims?: IssueTrustClaimInput[];
};

export type RevokeTrustCredentialInput = {
  credentialId: string;
  revokedAt?: Date;
  revocationReason?: string | null;
};

export type ExpireTrustCredentialInput = {
  credentialId: string;
};

export type TrustCredentialWithDetails = Prisma.TrustCredentialGetPayload<{
  include: typeof trustCredentialDetailsInclude;
}>;

export type TrustCredentialReferenceType =
  | "GoodissimaIdentity"
  | "CredentialType"
  | "TrustedOrganization";

export class TrustCredentialReferenceError extends Error {
  constructor(
    public readonly referenceType: TrustCredentialReferenceType,
    public readonly referenceId: string,
  ) {
    super(`${referenceType} not found: ${referenceId}`);
    this.name = "TrustCredentialReferenceError";
  }
}

const trustCredentialDetailsInclude = {
  credentialType: true,
  issuerTrustedOrganization: true,
  claims: true,
} satisfies Prisma.TrustCredentialInclude;

export async function issueTrustCredential(
  prisma: TrustCredentialServiceClient,
  input: IssueTrustCredentialInput,
): Promise<TrustCredentialWithDetails> {
  return prisma.$transaction(async (tx) => {
    const [identity, credentialType, issuerTrustedOrganization] = await Promise.all([
      tx.goodissimaIdentity.findUnique({
        where: { id: input.identityId },
        select: { id: true },
      }),
      tx.credentialType.findUnique({
        where: { id: input.credentialTypeId },
        select: { id: true },
      }),
      tx.trustedOrganization.findUnique({
        where: { id: input.issuerTrustedOrganizationId },
        select: { id: true },
      }),
    ]);

    if (!identity) {
      throw new TrustCredentialReferenceError("GoodissimaIdentity", input.identityId);
    }

    if (!credentialType) {
      throw new TrustCredentialReferenceError("CredentialType", input.credentialTypeId);
    }

    if (!issuerTrustedOrganization) {
      throw new TrustCredentialReferenceError(
        "TrustedOrganization",
        input.issuerTrustedOrganizationId,
      );
    }

    return tx.trustCredential.create({
      data: {
        identityId: input.identityId,
        credentialTypeId: input.credentialTypeId,
        issuerTrustedOrganizationId: input.issuerTrustedOrganizationId,
        status: TrustCredentialStatus.ACTIVE,
        issuedAt: input.issuedAt ?? new Date(),
        expiresAt: input.expiresAt ?? null,
        claims: {
          create: (input.claims ?? []).map((claim) => ({
            claimKey: claim.claimKey,
            claimType: claim.claimType,
            claimValue: claim.claimValue,
          })),
        },
      },
      include: trustCredentialDetailsInclude,
    });
  });
}

export async function revokeTrustCredential(
  prisma: TrustCredentialServiceClient,
  input: RevokeTrustCredentialInput,
) {
  return prisma.$transaction((tx) =>
    tx.trustCredential.update({
      where: { id: input.credentialId },
      data: {
        status: TrustCredentialStatus.REVOKED,
        revokedAt: input.revokedAt ?? new Date(),
        revocationReason: input.revocationReason ?? null,
      },
      include: trustCredentialDetailsInclude,
    }),
  );
}

export async function expireTrustCredential(
  prisma: TrustCredentialServiceClient,
  input: ExpireTrustCredentialInput,
) {
  return prisma.$transaction((tx) =>
    tx.trustCredential.update({
      where: { id: input.credentialId },
      data: {
        status: TrustCredentialStatus.EXPIRED,
      },
      include: trustCredentialDetailsInclude,
    }),
  );
}

export async function getActiveCredentialsForIdentity(
  prisma: Prisma.TransactionClient | PrismaClient,
  identityId: string,
) {
  return prisma.trustCredential.findMany({
    where: {
      identityId,
      status: TrustCredentialStatus.ACTIVE,
    },
    orderBy: { issuedAt: "desc" },
    include: trustCredentialDetailsInclude,
  });
}

export async function getClaimsForCredential(
  prisma: Prisma.TransactionClient | PrismaClient,
  credentialId: string,
) {
  return prisma.trustClaim.findMany({
    where: { credentialId },
    orderBy: { createdAt: "asc" },
  });
}
