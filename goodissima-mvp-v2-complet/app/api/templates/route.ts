import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeKey(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

const starterFieldsByType: Record<
  string,
  Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    step: number;
    position: number;
    options?: Array<{ label: string; value: string }>;
    validationRules?: Prisma.InputJsonObject;
  }>
> = {
  RECRUITMENT: [
    { key: "fullName", label: "Nom complet", type: "TEXT", required: true, step: 1, position: 1 },
    { key: "email", label: "Email", type: "EMAIL", required: true, step: 1, position: 2 },
    { key: "cv", label: "CV", type: "FILE", required: true, step: 2, position: 1, validationRules: { maxSizeMb: 10, allowedTypes: ["pdf", "doc", "docx"] } },
    { key: "consent", label: "J'accepte le traitement de ma candidature", type: "CHECKBOX", required: true, step: 3, position: 1 },
  ],
  REAL_ESTATE: [
    { key: "fullName", label: "Nom complet", type: "TEXT", required: true, step: 1, position: 1 },
    { key: "email", label: "Email", type: "EMAIL", required: true, step: 1, position: 2 },
    { key: "identityDocument", label: "Pièce d'identité", type: "FILE", required: true, step: 2, position: 1, validationRules: { maxSizeMb: 10, allowedTypes: ["pdf", "jpg", "png"] } },
    { key: "incomeProof", label: "Justificatif de revenus", type: "FILE", required: true, step: 2, position: 2, validationRules: { maxSizeMb: 10, allowedTypes: ["pdf"] } },
  ],
  SALES: [
    { key: "companyName", label: "Entreprise", type: "TEXT", required: true, step: 1, position: 1 },
    { key: "contactEmail", label: "Email contact", type: "EMAIL", required: true, step: 1, position: 2 },
    { key: "needType", label: "Besoin principal", type: "SELECT", required: true, step: 1, position: 3, options: [{ label: "Audit", value: "audit" }, { label: "Projet", value: "project" }] },
    { key: "brief", label: "Brief du projet", type: "TEXTAREA", required: true, step: 2, position: 1 },
  ],
  SUPPORT: [
    { key: "fullName", label: "Nom complet", type: "TEXT", required: true, step: 1, position: 1 },
    { key: "email", label: "Email", type: "EMAIL", required: true, step: 1, position: 2 },
    { key: "urgency", label: "Niveau d'urgence", type: "SELECT", required: true, step: 1, position: 3, options: [{ label: "Normal", value: "normal" }, { label: "Urgent", value: "urgent" }] },
    { key: "request", label: "Votre demande", type: "TEXTAREA", required: true, step: 2, position: 1 },
  ],
  KYC: [
    { key: "fullName", label: "Nom complet", type: "TEXT", required: true, step: 1, position: 1 },
    { key: "email", label: "Email", type: "EMAIL", required: true, step: 1, position: 2 },
    { key: "companyName", label: "Organisation", type: "TEXT", required: true, step: 1, position: 3 },
    { key: "identityDocument", label: "Justificatif d'identité", type: "FILE", required: true, step: 2, position: 1, validationRules: { maxSizeMb: 10, allowedTypes: ["pdf", "jpg", "png"] } },
  ],
};

export async function GET() {
  await getCurrentPrismaUser();

  const templates = await prisma.formTemplate.findMany({
    include: {
      _count: { select: { fields: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  await getCurrentPrismaUser();

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const key = normalizeKey(body.key);
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const starterFields = starterFieldsByType[typeof body.journeyType === "string" ? body.journeyType : ""] ?? [];

  if (!name) {
    return NextResponse.json({ error: "nom manquant" }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({ error: "key manquante" }, { status: 400 });
  }

  const formKey = `${key}_FORM`;
  const existing = await prisma.relationTemplate.findUnique({ where: { key }, select: { id: true } });
  const existingForm = await prisma.formTemplate.findUnique({ where: { key: formKey }, select: { id: true } });

  if (existing || existingForm) {
    return NextResponse.json({ error: "identifiant déjà utilisé" }, { status: 409 });
  }

  const template = await prisma.$transaction(async (tx) => {
    const relationTemplate = await tx.relationTemplate.create({
      data: {
        key,
        name,
        description,
        status: "DRAFT",
      },
    });

    const formTemplate = await tx.formTemplate.create({
      data: {
        key: formKey,
        name,
        description,
        relationTemplateId: relationTemplate.id,
      },
    });

    if (starterFields.length > 0) {
      await tx.formField.createMany({
        data: starterFields.map((field) => ({
          formTemplateId: formTemplate.id,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          step: field.step,
          position: field.position,
          options: field.options,
          validationRules: field.validationRules,
        })),
      });
    }

    return formTemplate;
  });

  return NextResponse.json(template, { status: 201 });
}
