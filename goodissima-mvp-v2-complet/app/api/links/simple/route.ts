import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { buildPublicAppUrl } from "@/lib/public-app-url";

const allowedTypes = new Set(["SECTION", "TEXT", "TEXTAREA", "EMAIL", "PHONE", "NUMBER", "DATE", "SELECT", "MULTISELECT", "FILE", "CHECKBOX"]);

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fieldKey(label: string, index: number) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
  const base = normalized ? normalized[0].toLowerCase() + normalized.slice(1) : `field${index + 1}`;
  return /^[A-Za-z]/.test(base) ? `${base}${index ? index + 1 : ""}` : `field${index + 1}`;
}

export async function POST(request: Request) {
  const owner = await getCurrentPrismaUser();
  const body = await request.json();
  const title = text(body.title, 160);
  const description = text(body.description, 1200);
  const welcomeMessage = text(body.welcomeMessage, 800);
  const admissionMode = body.admissionMode === "VERIFIED_ONLY" ? "VERIFIED_ONLY" : "OPEN";
  const expiresAtText = text(body.expiresAt, 20);
  const expiresAt = expiresAtText ? new Date(`${expiresAtText}T23:59:59.999Z`) : null;
  const rawFields = Array.isArray(body.fields) ? body.fields : [];

  if (!title) return NextResponse.json({ error: "Le titre du lien est obligatoire." }, { status: 400 });
  if (!rawFields.length) return NextResponse.json({ error: "Ajoutez au moins un champ." }, { status: 400 });
  if (body.humanValidated !== true) {
    return NextResponse.json({ error: "La validation humaine est obligatoire avant publication." }, { status: 400 });
  }

  const fields = rawFields.slice(0, 50).flatMap((value: unknown, index: number) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const label = text(row.label, 160);
    const type = text(row.type, 20).toUpperCase();
    if (!label || !allowedTypes.has(type)) return [];
    const options = Array.isArray(row.options)
      ? row.options.map((option) => text(option, 120)).filter(Boolean).slice(0, 30)
      : [];
    const rule = row.validationRules && typeof row.validationRules === "object" && !Array.isArray(row.validationRules)
      ? row.validationRules as Record<string, unknown>
      : null;
    return [{
      key: fieldKey(label, index),
      label,
      type,
      required: type === "SECTION" ? false : row.required === true,
      position: index + 1,
      options: type === "SELECT" || type === "MULTISELECT"
        ? options.map((option) => ({ label: option, value: option })) as Prisma.InputJsonValue
        : undefined,
      validationRules: rule ? {
        operator: text(rule.operator, 30),
        mode: rule.mode === "BLOCKING" ? "BLOCKING" : "INDICATIVE",
        value: text(rule.value, 160),
        value2: text(rule.value2, 160),
        city: text(rule.city, 160),
        radiusKm: Number(rule.radiusKm) || undefined,
        declarative: rule.operator === "CITY_RADIUS",
      } as Prisma.InputJsonValue : undefined,
    }];
  });

  if (!fields.length) return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });

  const unique = Math.random().toString(36).slice(2, 9);
  const relationKey = `SIMPLE_LINK_${Date.now()}_${unique}`.toUpperCase();
  const slug = `${slugify(title) || "lien"}-${unique.slice(0, 5)}`;

  const link = await prisma.$transaction(async (tx) => {
    const relationTemplate = await tx.relationTemplate.create({
      data: {
        key: relationKey,
        name: title,
        description: description || null,
        status: "DRAFT",
      },
    });
    const formTemplate = await tx.formTemplate.create({
      data: {
        key: `${relationKey}_FORM`,
        name: title,
        description: welcomeMessage || description || null,
        relationTemplateId: relationTemplate.id,
        fields: { create: fields },
      },
    });
    const createdLink = await tx.gLink.create({
      data: {
        ownerId: owner.id,
        templateId: relationTemplate.id,
        slug,
        title,
        description: description || null,
        admissionMode,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        rules: {
          simpleLink: true,
          welcomeMessage: welcomeMessage || null,
          humanValidated: true,
          automaticEmail: false,
          automaticNotification: false,
          automaticWorkflow: false,
          allowDocument: body.allowDocument === true,
          requireMessage: body.requireMessage === true,
          enhancedSecurity: body.enhancedSecurity === true,
          matchingEnabled: body.matchingEnabled === true,
          matchingEnabledAtCreation: body.matchingEnabled === true,
          matchingStatus: body.matchingEnabled === true ? "TO_ANALYZE" : "DISABLED",
        },
      },
    });
    return { ...createdLink, formTemplateId: formTemplate.id };
  });

  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  return NextResponse.json({
    id: link.id,
    slug: link.slug,
    publicUrl: buildPublicAppUrl(`/l/${encodeURIComponent(link.slug)}`),
  }, { status: 201 });
}
