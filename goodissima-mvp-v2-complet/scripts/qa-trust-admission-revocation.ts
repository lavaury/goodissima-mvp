import {
  CredentialTypeStatus,
  IdentityStatus,
  IdentityType,
  Prisma,
  PrismaClient,
  RelationStatus,
  TrustedOrganizationStatus,
  TrustClaimType,
} from "@prisma/client";

import { evaluateTrustAdmission } from "../lib/trust-admission";
import { createCandidateAccessExpiresAt, createCandidateAccessToken } from "../lib/candidate-access";
import { canCandidateWriteInRelation } from "../lib/relation-governance";
import {
  issueTrustCredentialInTransaction,
  revokeTrustCredential,
  type TrustCredentialServiceClient,
} from "../lib/trust-credentials";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";
const ROLLBACK_MESSAGE = "QA_TRUST_ADMISSION_REVOCATION_ROLLBACK";
const TRUST_ADMISSION_BLOCKED_CODE = "TRUST_ADMISSION_BLOCKED";
const TRUST_ADMISSION_BLOCKED_API_MESSAGE = "Admission blocked by Trust Admission requirements.";
const TRUST_ADMISSION_BLOCKED_UI_MESSAGE =
  "Cette relation nécessite une attestation valide. Elle peut être absente, expirée ou révoquée.";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createTransactionalCredentialService(tx: Prisma.TransactionClient) {
  return {
    $transaction: async <T>(callback: (innerTx: Prisma.TransactionClient) => Promise<T>) =>
      callback(tx),
  } as TrustCredentialServiceClient;
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
        reason: "QA trust admission revocation demo authority",
      },
    });
  }

  return tx.trustedOrganization.create({
    data: {
      organizationId: DEMO_ISSUER_ORGANIZATION_ID,
      status: TrustedOrganizationStatus.TRUSTED,
      reason: "QA trust admission revocation demo authority",
      approvedAt: new Date(),
    },
  });
}

async function createVerifiedIdentity(
  tx: Prisma.TransactionClient,
  input: {
    credentialTypeId: string;
    issuerTrustedOrganizationId: string;
  },
) {
  const identity = await tx.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.VERIFIED,
    },
  });

  const credential = await issueTrustCredentialInTransaction(tx, {
    identityId: identity.id,
    credentialTypeId: input.credentialTypeId,
    issuerTrustedOrganizationId: input.issuerTrustedOrganizationId,
    claims: [
      {
        claimKey: "identityVerified",
        claimType: TrustClaimType.BOOLEAN,
        claimValue: true,
      },
      {
        claimKey: "verificationMode",
        claimType: TrustClaimType.STRING,
        claimValue: "QA_DEMO_ONLY",
      },
    ],
  });

  return { identity, credential };
}

async function createVerifiedOnlyTrustPolicy(
  tx: Prisma.TransactionClient,
  credentialTypeId: string,
) {
  const trustPolicy = await tx.trustPolicy.create({
    data: {
      scope: "GLINK",
      status: "ACTIVE",
      reason: "QA trust admission revocation verified-only policy",
      version: 1,
    },
  });

  await tx.trustPolicyCredentialRequirement.create({
    data: {
      trustPolicyId: trustPolicy.id,
      credentialTypeId,
    },
  });

  return trustPolicy;
}

async function createOpenTrustPolicy(tx: Prisma.TransactionClient) {
  return tx.trustPolicy.create({
    data: {
      scope: "GLINK",
      status: "ACTIVE",
      reason: "QA public candidate standard open policy",
      version: 1,
    },
  });
}

function toPublicCandidateAdmissionResponse(
  evaluation: Awaited<ReturnType<typeof evaluateTrustAdmission>>,
) {
  if (evaluation.allowed) {
    return {
      status: 201,
      body: {
        candidateAccessToken: "qa-candidate-access-token",
      },
    };
  }

  return {
    status: 403,
    body: {
      error: TRUST_ADMISSION_BLOCKED_API_MESSAGE,
      code: TRUST_ADMISSION_BLOCKED_CODE,
    },
  };
}

function toPublicCandidateUiMessage(response: { body: { code?: string; error?: string } }) {
  return response.body.code === TRUST_ADMISSION_BLOCKED_CODE
    ? TRUST_ADMISSION_BLOCKED_UI_MESSAGE
    : response.body.error ?? "Erreur lors de l'action";
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const [credentialType, trustedOrganization] = await Promise.all([
      ensureVerifiedIdentityCredentialType(tx),
      ensureDemoTrustedOrganization(tx),
    ]);
    const credentialService = createTransactionalCredentialService(tx);

    const owner = await createVerifiedIdentity(tx, {
      credentialTypeId: credentialType.id,
      issuerTrustedOrganizationId: trustedOrganization.id,
    });
    await revokeTrustCredential(credentialService, {
      credentialId: owner.credential.id,
      revocationReason: "QA owner demo credential revoked",
    });

    const ownerUser = await tx.user.create({
      data: {
        email: `qa-owner-${Date.now()}@goodissima.local`,
        name: "QA Owner",
        goodissimaIdentityId: owner.identity.id,
      },
    });

    const gLink = await tx.gLink.create({
      data: {
        ownerId: ownerUser.id,
        slug: `qa-trust-admission-${Date.now()}`,
        title: "QA verified-only link",
        rules: {},
      },
    });
    const trustPolicy = await createVerifiedOnlyTrustPolicy(tx, credentialType.id);
    await tx.trustPolicy.update({
      where: { id: trustPolicy.id },
      data: { gLinkId: gLink.id },
    });
    const openTrustPolicy = await createOpenTrustPolicy(tx);

    const ownerCredentialEvaluation = await evaluateTrustAdmission(tx, {
      trustPolicyId: trustPolicy.id,
      candidateIdentityId: owner.identity.id,
    });
    assert(
      !ownerCredentialEvaluation.allowed,
      "Owner's revoked credential should not satisfy verified admission requirements.",
    );
    assert(gLink.ownerId === ownerUser.id, "Owner should still create a verified-only link.");

    const candidate = await createVerifiedIdentity(tx, {
      credentialTypeId: credentialType.id,
      issuerTrustedOrganizationId: trustedOrganization.id,
    });

    const beforeRevocation = await evaluateTrustAdmission(tx, {
      trustPolicyId: trustPolicy.id,
      candidateIdentityId: candidate.identity.id,
    });
    assert(beforeRevocation.allowed, "Verified candidate should be admitted before revocation.");
    assert(
      beforeRevocation.satisfiedCredentialTypes.includes(VERIFIED_IDENTITY),
      "Verified candidate should satisfy VERIFIED_IDENTITY before revocation.",
    );
    const publicResponseBeforeRevocation = toPublicCandidateAdmissionResponse(beforeRevocation);
    assert(
      publicResponseBeforeRevocation.status === 201,
      "Public candidate admission should return success before credential revocation.",
    );

    await revokeTrustCredential(credentialService, {
      credentialId: candidate.credential.id,
      revocationReason: "QA candidate credential revoked",
    });

    const afterRevocation = await evaluateTrustAdmission(tx, {
      trustPolicyId: trustPolicy.id,
      candidateIdentityId: candidate.identity.id,
    });
    assert(!afterRevocation.allowed, "Revoked credential should block new admission.");
    assert(
      afterRevocation.missingCredentialTypes.includes(VERIFIED_IDENTITY),
      "Revoked credential should be reported as missing VERIFIED_IDENTITY.",
    );
    const publicResponseAfterRevocation = toPublicCandidateAdmissionResponse(afterRevocation);
    assert(
      publicResponseAfterRevocation.status === 403,
      "Public candidate admission should return 403 after credential revocation.",
    );
    assert(
      publicResponseAfterRevocation.body.code === TRUST_ADMISSION_BLOCKED_CODE,
      "Public candidate admission should expose TRUST_ADMISSION_BLOCKED.",
    );
    assert(
      publicResponseAfterRevocation.body.error === TRUST_ADMISSION_BLOCKED_API_MESSAGE,
      "Public candidate admission should expose the API admission-blocked message.",
    );
    assert(
      !("trustPolicyId" in publicResponseAfterRevocation.body) &&
        !("requiredCredentialTypes" in publicResponseAfterRevocation.body) &&
        !("missingCredentialTypes" in publicResponseAfterRevocation.body),
      "Public candidate admission should not expose Trust Admission internals.",
    );
    assert(
      toPublicCandidateUiMessage(publicResponseAfterRevocation) === TRUST_ADMISSION_BLOCKED_UI_MESSAGE,
      "Public candidate UI should map TRUST_ADMISSION_BLOCKED to an explicit user message.",
    );

    const standardLinkEvaluation = await evaluateTrustAdmission(tx, {
      trustPolicyId: openTrustPolicy.id,
      candidateIdentityId: null,
    });
    assert(
      standardLinkEvaluation.allowed,
      "Standard public links without credential requirements should remain allowed.",
    );

    const existingRelationCase = await tx.relationCase.create({
      data: {
        gLinkId: gLink.id,
        ownerId: ownerUser.id,
        candidateIdentityId: candidate.identity.id,
        candidateAccessToken: createCandidateAccessToken(),
        candidateAccessExpiresAt: createCandidateAccessExpiresAt(),
        candidateName: "QA Candidate",
        candidateEmail: `qa-candidate-${Date.now()}@goodissima.local`,
        candidateEmailNotificationsEnabled: false,
        status: RelationStatus.NEW,
      },
    });
    assert(
      canCandidateWriteInRelation(existingRelationCase.governanceStatus),
      "Already granted secure conversations should remain writable while governance is active.",
    );

    console.log("QA trust admission revocation scenario passed.");
    console.log(
      JSON.stringify(
        {
          ownerCanCreateVerifiedOnlyLinkWithRevokedOwnCredential: true,
          candidateAdmissionBeforeRevocation: beforeRevocation.allowed,
          candidateAdmissionAfterRevocation: afterRevocation.allowed,
          publicCandidateStatusBeforeRevocation: publicResponseBeforeRevocation.status,
          publicCandidateStatusAfterRevocation: publicResponseAfterRevocation.status,
          publicCandidateApiMessageAfterRevocation: publicResponseAfterRevocation.body.error,
          publicCandidateUiMessageAfterRevocation: toPublicCandidateUiMessage(publicResponseAfterRevocation),
          missingAfterRevocation: afterRevocation.missingCredentialTypes,
          standardPublicLinkStillAllowed: standardLinkEvaluation.allowed,
          existingSecureConversationStillWritable: canCandidateWriteInRelation(existingRelationCase.governanceStatus),
        },
        null,
        2,
      ),
    );

    throw new Error(ROLLBACK_MESSAGE);
  });
}

main()
  .catch((error) => {
    if (error instanceof Error && error.message === ROLLBACK_MESSAGE) {
      return;
    }

    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
