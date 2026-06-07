import {
  PrismaClient,
  TrustedOrganizationStatus,
  TrustConnectorProviderType,
  TrustConnectorStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

type ConnectorSeed = {
  code: string;
  name: string;
  description: string;
  providerType: TrustConnectorProviderType;
  organizationReason: string;
};

const connectorSeeds: ConnectorSeed[] = [
  {
    code: "GOODISSIMA_DEMO_AUTHORITY",
    name: "Goodissima Demo Authority",
    description: "Demo connector used for staging and pilot trust flows.",
    providerType: TrustConnectorProviderType.DEMO,
    organizationReason: "Demo authority for verified admission link pilot",
  },
  {
    code: "FRANCE_IDENTITE",
    name: "France Identite",
    description: "Future connector placeholder for French government identity attestations.",
    providerType: TrustConnectorProviderType.GOVERNMENT,
    organizationReason: "Future trusted issuer for French identity attestations",
  },
  {
    code: "EIDAS_WALLET",
    name: "eIDAS Wallet",
    description: "Future connector placeholder for European wallet attestations.",
    providerType: TrustConnectorProviderType.EUROPEAN_WALLET,
    organizationReason: "Future trusted issuer for European wallet attestations",
  },
  {
    code: "BANK_CONNECT",
    name: "Bank Connect",
    description: "Future connector placeholder for banking attestations.",
    providerType: TrustConnectorProviderType.BANK,
    organizationReason: "Future trusted issuer for banking attestations",
  },
  {
    code: "EDUCATION_PROVIDER",
    name: "Education Provider",
    description: "Future connector placeholder for education attestations.",
    providerType: TrustConnectorProviderType.EDUCATION,
    organizationReason: "Future trusted issuer for education attestations",
  },
];

function assertSetupScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust connector setup script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes trust registry data.",
      ].join(" "),
    );
  }
}

async function ensureTrustedOrganization(seed: ConnectorSeed) {
  const existingOrganization = await prisma.trustedOrganization.findFirst({
    where: { organizationId: seed.code },
    orderBy: { createdAt: "asc" },
  });

  if (existingOrganization) {
    return prisma.trustedOrganization.update({
      where: { id: existingOrganization.id },
      data: {
        status: TrustedOrganizationStatus.TRUSTED,
        reason: seed.organizationReason,
        approvedAt: existingOrganization.approvedAt ?? new Date(),
      },
    });
  }

  return prisma.trustedOrganization.create({
    data: {
      organizationId: seed.code,
      status: TrustedOrganizationStatus.TRUSTED,
      reason: seed.organizationReason,
      approvedAt: new Date(),
    },
  });
}

async function ensureTrustConnector(seed: ConnectorSeed, trustedOrganizationId: string) {
  return prisma.trustConnector.upsert({
    where: { code: seed.code },
    update: {
      name: seed.name,
      description: seed.description,
      providerType: seed.providerType,
      status: TrustConnectorStatus.ACTIVE,
      trustedOrganizationId,
    },
    create: {
      code: seed.code,
      name: seed.name,
      description: seed.description,
      providerType: seed.providerType,
      status: TrustConnectorStatus.ACTIVE,
      trustedOrganizationId,
    },
  });
}

async function main() {
  assertSetupScriptAllowed();

  const results = [];

  for (const seed of connectorSeeds) {
    const trustedOrganization = await ensureTrustedOrganization(seed);
    const trustConnector = await ensureTrustConnector(seed, trustedOrganization.id);

    results.push({
      code: trustConnector.code,
      name: trustConnector.name,
      status: trustConnector.status,
      providerType: trustConnector.providerType,
      trustedOrganization: {
        organizationId: trustedOrganization.organizationId,
        status: trustedOrganization.status,
      },
    });
  }

  console.log("DEMO / STAGING ONLY - Trust connector registry setup completed.");
  console.log(
    JSON.stringify(
      {
        connectorCount: results.length,
        connectors: results,
        externalIntegrationsEnabled: false,
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
