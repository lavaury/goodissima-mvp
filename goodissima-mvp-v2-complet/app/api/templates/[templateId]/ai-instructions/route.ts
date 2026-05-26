import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const maxInstructionsLength = 4000;
const blockedPatterns = [
  /<script\b/i,
  /<\/script>/i,
  /```/,
  /\bignore\s+(all\s+)?previous\s+instructions\b/i,
  /\boverride\s+(system|safety|security)\b/i,
];

function cleanInstructions(value: unknown) {
  if (typeof value !== "string") return null;

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxInstructionsLength);
}

export async function PATCH(req: Request, { params }: { params: { templateId: string } }) {
  await getCurrentPrismaUser();

  const body = await req.json();
  const aiInstructions = cleanInstructions(body.aiInstructions);

  if (aiInstructions === null) {
    return NextResponse.json({ error: "Instructions IA invalides" }, { status: 400 });
  }

  if (blockedPatterns.some((pattern) => pattern.test(aiInstructions))) {
    return NextResponse.json(
      { error: "Les instructions IA doivent rester du texte metier, sans code ni tentative de surcharge securite." },
      { status: 400 },
    );
  }

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: params.templateId },
    select: { relationTemplateId: true },
  });

  if (!formTemplate?.relationTemplateId) {
    return NextResponse.json({ error: "Parcours introuvable" }, { status: 404 });
  }

  const updated = await prisma.relationTemplate.update({
    where: { id: formTemplate.relationTemplateId },
    data: { aiInstructions: aiInstructions || null },
    select: { id: true, aiInstructions: true },
  });

  return NextResponse.json(updated);
}
