import { CredentialTypeStatus, PrismaClient } from "@prisma/client";

const PILOT_CREDENTIAL_TYPE_CODE = "VERIFIED_IDENTITY";
const PILOT_POLICY_REASON = "Trust admission pilot - verified identity required";

const prisma = new PrismaClient();

function assertSetupScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust admission pilot setup script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes pilot trust data.",
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

async function ensureVerifiedIdentityCredentialType() {
  return prisma.credentialType.upsert({
    where: { code: PILOT_CREDENTIAL_TYPE_CODE },
    update: {
      name: "Identite verifiee",
      status: CredentialTypeStatus.ACTIVE,
    },
    create: {
      code: PILOT_CREDENTIAL_TYPE_CODE,
      name: "Identite verifiee",
      status: CredentialTypeStatus.ACTIVE,
    },
  });
}

async function resolvePilotTrustPolicy(gLinkId: string) {
  const existingActiveGLinkPolicy = await prisma.trustPolicy.findFirst({
    where: {
      scope: "GLINK",
      gLinkId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingActiveGLinkPolicy) {
    const trustPolicy = existingActiveGLinkPolicy.reason
      ? existingActiveGLinkPolicy
      : await prisma.trustPolicy.update({
          where: { id: existingActiveGLinkPolicy.id },
          data: { reason: PILOT_POLICY_REASON },
        });

    return {
      trustPolicy,
      strategy: "reused_latest_active_glink_policy",
    };
  }

  const trustPolicy = await prisma.trustPolicy.create({
    data: {
      scope: "GLINK",
      gLinkId,
      status: "ACTIVE",
      reason: PILOT_POLICY_REASON,
      version: 1,
    },
  });

  return {
    trustPolicy,
    strategy: "created_pilot_glink_policy",
  };
}

async function main() {
  assertSetupScriptAllowed();

  const gLinkId = getPilotGLinkId();
  const gLink = await prisma.gLink.findUnique({
    where: { id: gLinkId },
    select: {
      id: true,
      slug: true,
      title: true,
    },
  });

  if (!gLink) {
    throw new Error(`GLink not found: ${gLinkId}`);
  }

  const credentialType = await ensureVerifiedIdentityCredentialType();
  const { trustPolicy, strategy } = await resolvePilotTrustPolicy(gLink.id);

  await prisma.trustPolicyCredentialRequirement.upsert({
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

  const requirements = await prisma.trustPolicyCredentialRequirement.findMany({
    where: { trustPolicyId: trustPolicy.id },
    orderBy: { createdAt: "asc" },
    include: {
      credentialType: {
        select: {
          code: true,
        },
      },
    },
  });

  console.log("DEMO / STAGING ONLY - Trust admission pilot setup completed.");
  console.log(
    JSON.stringify(
      {
        gLinkId: gLink.id,
        gLink: {
          title: gLink.title,
          slug: gLink.slug,
        },
        trustPolicyId: trustPolicy.id,
        trustPolicyStrategy: strategy,
        trustPolicyReason: trustPolicy.reason,
        credentialRequirementCodes: requirements.map((requirement) => requirement.credentialType.code),
        dryRunEnvSuggestion: {
          TRUST_ADMISSION_CREDENTIALS_DRY_RUN: "true",
          TRUST_ADMISSION_PILOT_GLINK_IDS: gLink.id,
        },
        admissionBlockingEnabled: false,
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
