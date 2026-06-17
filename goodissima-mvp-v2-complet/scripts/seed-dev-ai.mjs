import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_OWNER_EMAIL = "jean.bernard.lavaury@numericable.fr";
const DEV_CANDIDATE_EMAIL = "camille.martin.dev@example.test";
const DEV_GLINK_SLUG = "dev-ai-test-goodissima";
const DEV_CASE_ACCESS_TOKEN = "dev-ai-test-case-access-token";

const STAGING_SUPABASE_REF = "rapidwfkaohweoovienf";
const PRODUCTION_SUPABASE_REF = "cbfcjyepfvuwugjiogoe";

function getConfiguredSupabaseRef() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].filter(Boolean);

  for (const value of candidates) {
    const projectUrlMatch = value.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
    if (projectUrlMatch) return projectUrlMatch[1];

    const dbHostMatch = value.match(/db\.([a-z0-9]+)\.supabase\.co/i);
    if (dbHostMatch) return dbHostMatch[1];

    const poolerUserMatch = value.match(/postgres\.([a-z0-9]+)[:@]/i);
    if (poolerUserMatch) return poolerUserMatch[1];
  }

  return null;
}

function assertDevEnvironment() {
  const environment = (process.env.GOODISSIMA_ENV ?? "local").toLowerCase();
  const vercelEnvironment = (process.env.VERCEL_ENV ?? "").toLowerCase();
  const supabaseRef = getConfiguredSupabaseRef();

  if (["production", "staging", "preview"].includes(environment)) {
    throw new Error(`Refusing to run dev seed with GOODISSIMA_ENV=${environment}.`);
  }

  if (["production", "preview"].includes(vercelEnvironment)) {
    throw new Error(`Refusing to run dev seed with VERCEL_ENV=${vercelEnvironment}.`);
  }

  if ([STAGING_SUPABASE_REF, PRODUCTION_SUPABASE_REF].includes(supabaseRef ?? "")) {
    throw new Error(`Refusing to run dev seed against protected Supabase project ${supabaseRef}.`);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
}

async function main() {
  assertDevEnvironment();

  const owner = await prisma.user.upsert({
    where: { email: DEV_OWNER_EMAIL },
    update: {
      name: "Jean Bernard Lavaury",
      role: "OWNER",
    },
    create: {
      email: DEV_OWNER_EMAIL,
      name: "Jean Bernard Lavaury",
      role: "OWNER",
    },
  });

  await prisma.userNotificationPreference.upsert({
    where: { userId: owner.id },
    update: {},
    create: {
      userId: owner.id,
      emailNotificationsEnabled: true,
      newMessagesEnabled: true,
      newRequestsEnabled: true,
      newDocumentsEnabled: true,
      validationsEnabled: true,
      relationalPrivacyEnabled: true,
      pseudonymizationEnabled: true,
      frequency: "IMMEDIATE",
    },
  });

  await prisma.accessInvitation.upsert({
    where: { email: DEV_OWNER_EMAIL },
    update: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      expiresAt: null,
      note: "Dev local AI seed access",
    },
    create: {
      email: DEV_OWNER_EMAIL,
      status: "ACCEPTED",
      acceptedAt: new Date(),
      note: "Dev local AI seed access",
    },
  });

  const template = await prisma.relationTemplate.upsert({
    where: { key: "DEV_AI_TEST_RELATION" },
    update: {
      name: "Dev IA - Dossier test",
      description: "Template fictif pour tester les fonctions IA en local.",
      status: "PUBLISHED",
      aiInstructions:
        "Produire une synthese prudente, ne jamais prendre de decision automatique, proposer uniquement des actions humaines.",
    },
    create: {
      key: "DEV_AI_TEST_RELATION",
      name: "Dev IA - Dossier test",
      description: "Template fictif pour tester les fonctions IA en local.",
      status: "PUBLISHED",
      aiInstructions:
        "Produire une synthese prudente, ne jamais prendre de decision automatique, proposer uniquement des actions humaines.",
    },
  });

  const gLink = await prisma.gLink.upsert({
    where: { slug: DEV_GLINK_SLUG },
    update: {
      ownerId: owner.id,
      templateId: template.id,
      title: "Lien dev IA - appartement fictif",
      city: "Lyon",
      description: "Lien fictif pour tester les syntheses, risques, brouillons et timeline IA.",
      status: "ACTIVE",
      rules: {
        purpose: "dev_ai_testing",
        fictitiousDataOnly: true,
        expectedDocuments: ["identity", "income", "guarantor"],
      },
    },
    create: {
      ownerId: owner.id,
      templateId: template.id,
      slug: DEV_GLINK_SLUG,
      title: "Lien dev IA - appartement fictif",
      city: "Lyon",
      description: "Lien fictif pour tester les syntheses, risques, brouillons et timeline IA.",
      status: "ACTIVE",
      rules: {
        purpose: "dev_ai_testing",
        fictitiousDataOnly: true,
        expectedDocuments: ["identity", "income", "guarantor"],
      },
    },
  });

  const relationCase = await prisma.relationCase.upsert({
    where: { candidateAccessToken: DEV_CASE_ACCESS_TOKEN },
    update: {
      gLinkId: gLink.id,
      ownerId: owner.id,
      templateId: template.id,
      candidateName: "Camille Martin",
      candidateEmail: DEV_CANDIDATE_EMAIL,
      candidateEmailNotificationsEnabled: true,
      matchingEnabled: true,
      priority: "HIGH",
      status: "REVIEWING",
      governanceStatus: "ACTIVE",
      currentStep: "CONVERSATION",
    },
    create: {
      gLinkId: gLink.id,
      ownerId: owner.id,
      templateId: template.id,
      candidateAccessToken: DEV_CASE_ACCESS_TOKEN,
      candidateName: "Camille Martin",
      candidateEmail: DEV_CANDIDATE_EMAIL,
      candidateEmailNotificationsEnabled: true,
      matchingEnabled: true,
      priority: "HIGH",
      status: "REVIEWING",
      governanceStatus: "ACTIVE",
      currentStep: "CONVERSATION",
    },
  });

  await prisma.message.deleteMany({ where: { caseId: relationCase.id } });
  await prisma.document.deleteMany({ where: { caseId: relationCase.id } });
  await prisma.relationAction.deleteMany({ where: { relationCaseId: relationCase.id } });

  await prisma.message.createMany({
    data: [
      {
        caseId: relationCase.id,
        senderType: "CANDIDATE",
        senderEmail: DEV_CANDIDATE_EMAIL,
        body:
          "Bonjour, je suis interessee par l'appartement fictif de Lyon. Je suis en CDI depuis 18 mois et je peux fournir mes justificatifs.",
      },
      {
        caseId: relationCase.id,
        senderType: "OWNER",
        senderEmail: DEV_OWNER_EMAIL,
        body:
          "Bonjour Camille, merci pour votre message. Pouvez-vous transmettre une piece d'identite, vos trois derniers bulletins de salaire et confirmer si vous avez un garant ?",
      },
      {
        caseId: relationCase.id,
        senderType: "CANDIDATE",
        senderEmail: DEV_CANDIDATE_EMAIL,
        body:
          "J'ai ajoute ma piece d'identite et deux bulletins. Le troisieme arrive demain. Mon garant potentiel est mon frere, mais il doit encore confirmer.",
      },
      {
        caseId: relationCase.id,
        senderType: "OWNER",
        senderEmail: DEV_OWNER_EMAIL,
        body:
          "Merci. Il reste donc un bulletin de salaire et la confirmation du garant avant une revue humaine complete du dossier.",
      },
    ],
  });

  await prisma.document.createMany({
    data: [
      {
        caseId: relationCase.id,
        uploadedByEmail: DEV_CANDIDATE_EMAIL,
        fileName: "piece-identite-fictive.pdf",
        fileUrl: "https://example.test/goodissima/dev-ai/piece-identite-fictive.pdf",
        mimeType: "application/pdf",
      },
      {
        caseId: relationCase.id,
        uploadedByEmail: DEV_CANDIDATE_EMAIL,
        fileName: "bulletin-salaire-janvier-fictif.pdf",
        fileUrl: "https://example.test/goodissima/dev-ai/bulletin-salaire-janvier-fictif.pdf",
        mimeType: "application/pdf",
      },
      {
        caseId: relationCase.id,
        uploadedByEmail: DEV_CANDIDATE_EMAIL,
        fileName: "bulletin-salaire-fevrier-fictif.pdf",
        fileUrl: "https://example.test/goodissima/dev-ai/bulletin-salaire-fevrier-fictif.pdf",
        mimeType: "application/pdf",
      },
    ],
  });

  await prisma.relationAction.create({
    data: {
      relationCaseId: relationCase.id,
      type: "REQUEST_DOCUMENT",
      status: "PENDING",
      title: "Demander le troisieme bulletin fictif",
      description: "Action de test pour verifier les suggestions IA et la timeline.",
      createdByRole: "OWNER",
      payload: {
        seed: "dev-ai",
        missingDocument: "bulletin-salaire-mars-fictif.pdf",
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      caseId: relationCase.id,
      actorEmail: DEV_OWNER_EMAIL,
      eventType: "DEV_AI_SEED_CREATED",
      metadata: {
        fictitiousDataOnly: true,
        gLinkSlug: DEV_GLINK_SLUG,
        candidateAccessToken: DEV_CASE_ACCESS_TOKEN,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment: process.env.GOODISSIMA_ENV ?? "local",
        supabaseRef: getConfiguredSupabaseRef(),
        ownerEmail: owner.email,
        gLinkSlug: gLink.slug,
        relationCaseId: relationCase.id,
        candidateAccessToken: relationCase.candidateAccessToken,
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
