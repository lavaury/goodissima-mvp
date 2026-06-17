import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { generateTemplateDraft, recordTemplateGeneration } from "@/lib/ai/template-designer";
import { validateTemplateDraftQuality } from "@/lib/ai/template-draft-quality";
import { checkCandidatePublicationSafety, toCandidateFormField } from "@/lib/candidate-form-safety";
import { parseVoiceAuditInput } from "@/lib/voice-opportunity";

export async function POST(req: Request) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const voiceAudit = parseVoiceAuditInput(body.voiceAudit, "generation");

    if (description.length < 20) {
      return NextResponse.json({ error: "Décrivez le parcours en au moins 20 caractères." }, { status: 400 });
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: "La description est limitée à 5 000 caractères." }, { status: 400 });
    }

    const result = await generateTemplateDraft(description, {
      userId: owner.id,
      organizationId: owner.id,
      organizationName: owner.name ?? owner.email,
    });
    const validation = validateTemplateDraftQuality({ draft: result.draft, provenance: result.provenance });
    const candidateFormSafety = checkCandidatePublicationSafety(result.draft.fields.map((field) => toCandidateFormField(field)));
    const generation = await recordTemplateGeneration({ createdById: owner.id, description, result, voiceAudit });

    return NextResponse.json({
      generationId: generation.id,
      status: "GENERATED",
      persistence: "PROVENANCE_ONLY",
      requiresHumanValidation: true,
      draft: result.draft,
      provenance: result.provenance,
      validation,
      candidateFormSafety,
      voiceAuditStored: Boolean(voiceAudit),
    });
  } catch (error) {
    console.error("[ai-template-designer] generation failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Impossible de générer le brouillon." }, { status: 500 });
  }
}
