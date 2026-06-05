import {
  CredentialTypeStatus,
  PrismaClient,
  TrustedOrganizationStatus,
} from "@prisma/client";

const SYSTEM_ORGANIZATION_ID = "GOODISSIMA_SYSTEM";
const SYSTEM_CREDENTIAL_TYPE_CODE = "CANDIDATE_CREATED";

const prisma = new PrismaClient();

function assertSetupScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run system trust issuer setup script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes system trust setup data.",
      ].join(" "),
    );
  }
}

async function ensureSystemTrustedOrganization() {
  const existingOrganization = await prisma.trustedOrganization.findFirst({
    where: { organizationId: SYSTEM_ORGANIZATION_ID },
    orderBy: { createdAt: "asc" },
  });

  if (existingOrganization) {
    return prisma.trustedOrganization.update({
      where: { id: existingOrganization.id },
      data: {
        status: TrustedOrganizationStatus.TRUSTED,
        reason: "System issuer for internal lifecycle credentials",
      },
    });
  }

  return prisma.trustedOrganization.create({
    data: {
      organizationId: SYSTEM_ORGANIZATION_ID,
      status: TrustedOrganizationStatus.TRUSTED,
      reason: "System issuer for internal lifecycle credentials",
      approvedAt: new Date(),
    },
  });
}

async function ensureSystemCredentialType() {
  return prisma.credentialType.upsert({
    where: { code: SYSTEM_CREDENTIAL_TYPE_CODE },
    update: {
      name: "Candidature creee",
      description: "Internal lifecycle credential, not a verified identity credential.",
      status: CredentialTypeStatus.ACTIVE,
    },
    create: {
      code: SYSTEM_CREDENTIAL_TYPE_CODE,
      name: "Candidature creee",
      description: "Internal lifecycle credential, not a verified identity credential.",
      status: CredentialTypeStatus.ACTIVE,
    },
  });
}

async function main() {
  assertSetupScriptAllowed();

  const [trustedOrganization, credentialType] = await Promise.all([
    ensureSystemTrustedOrganization(),
    ensureSystemCredentialType(),
  ]);

  console.log("DEMO / STAGING ONLY - System trust issuer setup completed.");
  console.log(
    JSON.stringify(
      {
        trustedOrganization: {
          id: trustedOrganization.id,
          organizationId: trustedOrganization.organizationId,
          status: trustedOrganization.status,
          approvedAt: trustedOrganization.approvedAt,
          reason: trustedOrganization.reason,
        },
        credentialType: {
          id: credentialType.id,
          code: credentialType.code,
          name: credentialType.name,
          description: credentialType.description,
          status: credentialType.status,
        },
        automaticCredentialIssuanceEnabled: false,
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
