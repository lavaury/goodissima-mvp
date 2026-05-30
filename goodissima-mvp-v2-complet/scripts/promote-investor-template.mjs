import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATE_DEFINITION = {
  key: "INVESTOR_INTRODUCTION",
  name: "Introduction investisseur",
  description: "Parcours de qualification sécurisé pour investisseurs et partenaires stratégiques.",
  status: "PUBLISHED",
  isDefault: false,
  aiInstructions:
    "Identifier l'intérêt stratégique, les questions ouvertes et les prochaines étapes possibles sans promettre de résultat. Rester factuel, privacy-first et human-in-the-loop.",
  formTemplate: {
    key: "INVESTOR_INTRODUCTION_FORM",
    name: "Introduction investisseur",
    description: "Parcours de qualification sécurisé pour investisseurs et partenaires stratégiques.",
  },
  fields: [
    { key: "name", label: "Nom et prénom", type: "TEXT", required: true, step: 1, position: 1 },
    { key: "organization", label: "Organisation / Fonds d’investissement", type: "TEXT", required: false, step: 1, position: 2 },
    { key: "role", label: "Fonction", type: "TEXT", required: false, step: 1, position: 3 },
    { key: "country", label: "Pays", type: "TEXT", required: false, step: 1, position: 4 },
    {
      key: "interestType",
      label: "Nature de votre intérêt",
      type: "SELECT",
      required: true,
      step: 2,
      position: 1,
      options: [
        { label: "Investissement", value: "investment" },
        { label: "Partenariat stratégique", value: "strategic_partnership" },
        { label: "Banque / Finance", value: "banking" },
        { label: "IA", value: "ai" },
        { label: "Marketplace", value: "marketplace" },
        { label: "Entreprise", value: "enterprise" },
        { label: "Média", value: "media" },
        { label: "Autre", value: "other" },
      ],
    },
    {
      key: "message",
      label: "Présentez votre intérêt pour Goodissima",
      type: "TEXTAREA",
      required: true,
      step: 2,
      position: 2,
    },
    {
      key: "notificationOptIn",
      label: "Je souhaite être informé des mises à jour de cet échange sécurisé.",
      type: "CHECKBOX",
      required: false,
      step: 3,
      position: 1,
    },
    {
      key: "notificationEmail",
      label: "Adresse email de notification",
      type: "EMAIL",
      required: false,
      step: 3,
      position: 2,
      conditionalRules: [
        { field: "notificationOptIn", operator: "equals", value: true, action: "SHOW" },
        { field: "notificationOptIn", operator: "equals", value: true, action: "REQUIRE" },
      ],
    },
  ],
};

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function redactedDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "missing";

  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "present-but-unparseable";
  }
}

function assertExecutionIsConfirmed() {
  const targetEnv = (process.env.GOODISSIMA_ENV ?? "undefined").toLowerCase();
  const confirmed = process.env.CONFIRM_TEMPLATE_IMPORT === "true";
  const allowedEnvironments = new Set(["staging", "production"]);

  console.log("[investor-template] Target environment", {
    GOODISSIMA_ENV: targetEnv,
    NODE_ENV: process.env.NODE_ENV ?? "undefined",
    database: redactedDatabaseUrl(),
  });

  if (!allowedEnvironments.has(targetEnv) && !confirmed) {
    throw new Error(
      'Refusing to run outside staging/production without explicit confirmation. Set CONFIRM_TEMPLATE_IMPORT=true.',
    );
  }
}

function buildSnapshot(relationTemplate, formTemplate, fields) {
  return {
    relationTemplate: {
      id: relationTemplate.id,
      key: relationTemplate.key,
      name: relationTemplate.name,
      description: relationTemplate.description,
    },
    formTemplate: {
      id: formTemplate.id,
      key: formTemplate.key,
      name: formTemplate.name,
      description: formTemplate.description,
    },
    fields: fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type.toUpperCase(),
      required: field.required,
      placeholder: field.placeholder,
      defaultValue: field.defaultValue,
      step: field.step,
      options: field.options,
      conditionalRules: field.conditionalRules,
      validationRules: field.validationRules,
    })),
    metadata: {
      snapshotVersion: 1,
      promotedFrom: "dev/local",
      promotedTemplateKey: TEMPLATE_DEFINITION.key,
    },
  };
}

async function countGuardTables(tx) {
  const [cases, messages, documents, links] = await Promise.all([
    tx.relationCase.count(),
    tx.message.count(),
    tx.document.count(),
    tx.gLink.count(),
  ]);

  return { relationCases: cases, messages, documents, links };
}

async function main() {
  assertExecutionIsConfirmed();

  console.log("[investor-template] Starting idempotent promotion", {
    templateKey: TEMPLATE_DEFINITION.key,
    touchedTables: ["RelationTemplate", "FormTemplate", "FormField", "TemplateVersion"],
    excludedTables: ["RelationCase", "Message", "Document", "GLink", "RelationAction"],
  });

  const result = await prisma.$transaction(async (tx) => {
    const guardBefore = await countGuardTables(tx);

    const existingTemplate = await tx.relationTemplate.findUnique({
      where: { key: TEMPLATE_DEFINITION.key },
      select: { id: true },
    });

    const relationTemplate = await tx.relationTemplate.upsert({
      where: { key: TEMPLATE_DEFINITION.key },
      create: {
        key: TEMPLATE_DEFINITION.key,
        name: TEMPLATE_DEFINITION.name,
        description: TEMPLATE_DEFINITION.description,
        status: TEMPLATE_DEFINITION.status,
        isDefault: TEMPLATE_DEFINITION.isDefault,
        aiInstructions: TEMPLATE_DEFINITION.aiInstructions,
      },
      update: {
        name: TEMPLATE_DEFINITION.name,
        description: TEMPLATE_DEFINITION.description,
        status: TEMPLATE_DEFINITION.status,
        isDefault: TEMPLATE_DEFINITION.isDefault,
        aiInstructions: TEMPLATE_DEFINITION.aiInstructions,
      },
    });

    const existingForm = await tx.formTemplate.findUnique({
      where: { key: TEMPLATE_DEFINITION.formTemplate.key },
      select: { id: true },
    });

    const formTemplate = await tx.formTemplate.upsert({
      where: { key: TEMPLATE_DEFINITION.formTemplate.key },
      create: {
        key: TEMPLATE_DEFINITION.formTemplate.key,
        name: TEMPLATE_DEFINITION.formTemplate.name,
        description: TEMPLATE_DEFINITION.formTemplate.description,
        relationTemplateId: relationTemplate.id,
      },
      update: {
        name: TEMPLATE_DEFINITION.formTemplate.name,
        description: TEMPLATE_DEFINITION.formTemplate.description,
        relationTemplateId: relationTemplate.id,
      },
    });

    await tx.formField.deleteMany({ where: { formTemplateId: formTemplate.id } });
    await tx.formField.createMany({
      data: TEMPLATE_DEFINITION.fields.map((field) => ({
        formTemplateId: formTemplate.id,
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder ?? null,
        defaultValue: field.defaultValue ?? null,
        position: field.position,
        step: field.step,
        options: field.options ?? undefined,
        validationRules: field.validationRules ?? undefined,
        conditionalRules: field.conditionalRules ?? undefined,
      })),
    });

    const fields = await tx.formField.findMany({
      where: { formTemplateId: formTemplate.id },
      orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    });
    const snapshot = buildSnapshot(relationTemplate, formTemplate, fields);
    const snapshotSignature = stableStringify(snapshot);

    const versions = await tx.templateVersion.findMany({
      where: { templateId: relationTemplate.id },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
    const activeVersion = versions.find((version) => version.isPublished);
    const matchingVersion = versions.find((version) => stableStringify(version.snapshot) === snapshotSignature);

    let publishedVersion;
    let versionAction;

    if (activeVersion && stableStringify(activeVersion.snapshot) === snapshotSignature) {
      publishedVersion = await tx.templateVersion.update({
        where: { id: activeVersion.id },
        data: {
          name: TEMPLATE_DEFINITION.name,
          description: TEMPLATE_DEFINITION.description,
        },
      });
      versionAction = "kept_active_version";
    } else if (matchingVersion) {
      await tx.templateVersion.updateMany({
        where: { templateId: relationTemplate.id, isPublished: true },
        data: { isPublished: false },
      });
      publishedVersion = await tx.templateVersion.update({
        where: { id: matchingVersion.id },
        data: {
          name: TEMPLATE_DEFINITION.name,
          description: TEMPLATE_DEFINITION.description,
          isPublished: true,
        },
      });
      versionAction = "republished_matching_version";
    } else {
      const nextVersion = (versions[0]?.version ?? 0) + 1;
      await tx.templateVersion.updateMany({
        where: { templateId: relationTemplate.id, isPublished: true },
        data: { isPublished: false },
      });
      publishedVersion = await tx.templateVersion.create({
        data: {
          templateId: relationTemplate.id,
          version: nextVersion,
          name: TEMPLATE_DEFINITION.name,
          description: TEMPLATE_DEFINITION.description,
          snapshot,
          isPublished: true,
        },
      });
      versionAction = "created_new_version";
    }

    const guardAfter = await countGuardTables(tx);

    if (stableStringify(guardBefore) !== stableStringify(guardAfter)) {
      throw new Error(
        `Safety check failed: forbidden table counts changed from ${stableStringify(guardBefore)} to ${stableStringify(
          guardAfter,
        )}`,
      );
    }

    return {
      templateAction: existingTemplate ? "updated" : "created",
      formAction: existingForm ? "updated" : "created",
      fieldCount: fields.length,
      versionAction,
      publishedVersion: publishedVersion.version,
      guardBefore,
      guardAfter,
    };
  });

  console.log("[investor-template] Promotion complete", result);
}

main()
  .catch((error) => {
    console.error("[investor-template] Promotion failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
