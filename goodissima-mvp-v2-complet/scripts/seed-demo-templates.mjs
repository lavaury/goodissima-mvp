import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demos = [
  {
    key: "DEMO_RECRUTEMENT",
    name: "Recrutement",
    description: "Parcours candidat avec CV, consentement et validation RH.",
    fields: [
      { key: "fullName", label: "Nom complet", type: "TEXT", required: true, step: 1, position: 1 },
      { key: "email", label: "Email", type: "EMAIL", required: true, step: 1, position: 2 },
      { key: "role", label: "Poste vise", type: "TEXT", required: true, step: 1, position: 3 },
      { key: "cv", label: "CV", type: "FILE", required: true, step: 2, position: 1, validationRules: { allowedTypes: ["pdf", "doc", "docx"], maxSizeMb: 10 } },
      { key: "message", label: "Message au recruteur", type: "TEXTAREA", required: false, step: 2, position: 2 },
      { key: "consent", label: "J'accepte le traitement de ma candidature", type: "CHECKBOX", required: true, step: 3, position: 1 },
      { key: "hrValidation", label: "Validation RH attendue", type: "CHECKBOX", required: false, step: 3, position: 2 },
    ],
  },
  {
    key: "DEMO_IMMOBILIER",
    name: "Immobilier",
    description: "Collecte de justificatifs et validation d'un dossier locatif.",
    fields: [
      { key: "fullName", label: "Nom complet", type: "TEXT", required: true, step: 1, position: 1 },
      { key: "email", label: "Email", type: "EMAIL", required: true, step: 1, position: 2 },
      { key: "housingType", label: "Type de bien", type: "SELECT", required: true, step: 1, position: 3, options: [{ label: "Appartement", value: "apartment" }, { label: "Maison", value: "house" }] },
      { key: "identityDocument", label: "Piece d'identite", type: "FILE", required: true, step: 2, position: 1, validationRules: { allowedTypes: ["pdf", "jpg", "png"], maxSizeMb: 10 } },
      { key: "incomeProof", label: "Justificatif de revenus", type: "FILE", required: true, step: 2, position: 2, validationRules: { allowedTypes: ["pdf"], maxSizeMb: 10 } },
      { key: "ownerMessage", label: "Precision sur le dossier", type: "TEXTAREA", required: false, step: 3, position: 1 },
      { key: "validation", label: "Je confirme l'exactitude des pieces fournies", type: "CHECKBOX", required: true, step: 3, position: 2 },
    ],
  },
  {
    key: "DEMO_VENTE_QUALIFICATION",
    name: "Vente / qualification",
    description: "Qualification d'un besoin, demande de devis et decision.",
    fields: [
      { key: "companyName", label: "Entreprise", type: "TEXT", required: true, step: 1, position: 1 },
      { key: "contactEmail", label: "Email contact", type: "EMAIL", required: true, step: 1, position: 2 },
      { key: "needType", label: "Besoin principal", type: "SELECT", required: true, step: 1, position: 3, options: [{ label: "Audit", value: "audit" }, { label: "Accompagnement", value: "support" }, { label: "Projet complet", value: "project" }] },
      { key: "budget", label: "Budget estime", type: "NUMBER", required: false, step: 2, position: 1 },
      { key: "brief", label: "Brief du projet", type: "TEXTAREA", required: true, step: 2, position: 2 },
      { key: "quoteFile", label: "Devis ou brief existant", type: "FILE", required: false, step: 2, position: 3, validationRules: { allowedTypes: ["pdf", "doc", "docx"], maxSizeMb: 10 } },
      { key: "decision", label: "Decision attendue", type: "SELECT", required: true, step: 3, position: 1, options: [{ label: "A recontacter", value: "follow_up" }, { label: "Pret pour devis", value: "quote" }, { label: "Non prioritaire", value: "later" }] },
    ],
  },
];

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
      type: field.type,
      required: field.required,
      placeholder: field.placeholder ?? null,
      defaultValue: null,
      step: field.step,
      options: field.options ?? null,
      conditionalRules: field.conditionalRules ?? null,
      validationRules: field.validationRules ?? null,
    })),
    metadata: { snapshotVersion: 1 },
  };
}

for (const demo of demos) {
  const relationTemplate = await prisma.relationTemplate.upsert({
    where: { key: demo.key },
    update: {
      name: demo.name,
      description: demo.description,
      status: "PUBLISHED",
    },
    create: {
      key: demo.key,
      name: demo.name,
      description: demo.description,
      status: "PUBLISHED",
    },
  });

  const formTemplate = await prisma.formTemplate.upsert({
    where: { key: `${demo.key}_FORM` },
    update: {
      name: demo.name,
      description: demo.description,
      relationTemplateId: relationTemplate.id,
    },
    create: {
      key: `${demo.key}_FORM`,
      name: demo.name,
      description: demo.description,
      relationTemplateId: relationTemplate.id,
    },
  });

  await prisma.formField.deleteMany({ where: { formTemplateId: formTemplate.id } });
  await prisma.formField.createMany({
    data: demo.fields.map((field) => ({
      formTemplateId: formTemplate.id,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder ?? null,
      position: field.position,
      step: field.step,
      options: field.options ?? undefined,
      validationRules: field.validationRules ?? undefined,
      conditionalRules: field.conditionalRules ?? undefined,
    })),
  });

  const createdFields = await prisma.formField.findMany({
    where: { formTemplateId: formTemplate.id },
    orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  const lastVersion = await prisma.templateVersion.findFirst({
    where: { templateId: relationTemplate.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastVersion?.version ?? 0) + 1;
  const snapshot = buildSnapshot(relationTemplate, formTemplate, createdFields);

  await prisma.templateVersion.updateMany({
    where: { templateId: relationTemplate.id, isPublished: true },
    data: { isPublished: false },
  });
  await prisma.templateVersion.create({
    data: {
      templateId: relationTemplate.id,
      version,
      name: relationTemplate.name,
      description: relationTemplate.description,
      snapshot,
      isPublished: true,
    },
  });
}

await prisma.$disconnect();
console.log("Demo templates ready");
