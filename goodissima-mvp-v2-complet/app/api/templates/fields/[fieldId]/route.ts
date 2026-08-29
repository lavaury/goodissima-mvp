import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAuthorizedMutableFormField } from "@/lib/template-authorization";

const fieldTypes = new Set(["TEXT", "EMAIL", "TEXTAREA", "PHONE", "NUMBER", "DATE", "SELECT", "CHECKBOX", "FILE"]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseJsonInput(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) return Prisma.JsonNull;

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    throw new Error(`${fieldName} invalide`);
  }
}

function parseStep(value: unknown) {
  const step = typeof value === "number" ? value : typeof value === "string" && value ? Number(value) : 1;

  return Number.isInteger(step) && step > 0 ? step : null;
}

export async function PATCH(req: Request, { params }: { params: { fieldId: string } }) {
  const owner = await getCurrentPrismaUser();

  const body = await req.json();
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim().toUpperCase() : "";
  const step = parseStep(body.step);

  if (!key) return jsonError("champ key manquant");
  if (!label) return jsonError("label manquant");
  if (!fieldTypes.has(type)) return jsonError("type invalide");
  if (!step) return jsonError("step invalide");

  let jsonFields;
  try {
    jsonFields = {
      options: parseJsonInput(body.optionsJson, "options JSON"),
      conditionalRules: parseJsonInput(body.conditionalRulesJson, "conditionalRules JSON"),
      validationRules: parseJsonInput(body.validationRulesJson, "validationRules JSON"),
    };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "JSON invalide");
  }

  const authorizedField = await resolveAuthorizedMutableFormField(params.fieldId, owner.id);
  if (!authorizedField) return jsonError("champ introuvable", 404);

  const field = await prisma.formField.update({
    where: { id: authorizedField.id },
    data: {
      key,
      label,
      type,
      required: Boolean(body.required),
      step,
      placeholder: typeof body.placeholder === "string" && body.placeholder ? body.placeholder : null,
      ...jsonFields,
    },
  });

  return NextResponse.json(field);
}

export async function DELETE(_req: Request, { params }: { params: { fieldId: string } }) {
  const owner = await getCurrentPrismaUser();

  const field = await resolveAuthorizedMutableFormField(params.fieldId, owner.id);
  if (!field) return jsonError("champ introuvable", 404);

  await prisma.formField.delete({
    where: { id: field.id },
  });

  return NextResponse.json({ ok: true });
}
