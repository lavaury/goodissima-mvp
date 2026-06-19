import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { parseTemplateDesignerDraft, recordTemplateGeneration, reviseTemplateDraft } from "@/lib/ai/template-designer";
import { validateTemplateDraftQuality } from "@/lib/ai/template-draft-quality";
import { checkCandidatePublicationSafety, toCandidateFormField } from "@/lib/candidate-form-safety";
import { prisma } from "@/lib/prisma";
import { parseVoiceAuditInput, voiceRevisionContext } from "@/lib/voice-opportunity";

export async function POST(req: Request, { params }: { params: { generationId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    if (feedback.length < 3) return NextResponse.json({ error: "Précisez la modification souhaitée." }, { status: 400 });
    if (feedback.length > 2000) return NextResponse.json({ error: "Le commentaire est limité à 2 000 caractères." }, { status: 400 });

    const source = await prisma.templateGeneration.findFirst({ where: { id: params.generationId, createdById: owner.id } });
    if (!source) return NextResponse.json({ error: "Proposition source introuvable." }, { status: 404 });
    if (source.status !== "GENERATED") return NextResponse.json({ error: "Une proposition déjà validée ne peut plus être révisée ici." }, { status: 409 });

    const current = parseTemplateDesignerDraft(body.currentDraft ?? source.output);
    const requestedVersion = Number.isInteger(body.proposalVersion) ? body.proposalVersion : source.proposalVersion + 1;
    const voiceAudit = parseVoiceAuditInput(body.voiceAudit, "refinement");
    const contextualFeedback = voiceAudit
      ? voiceRevisionContext({ transcript: feedback, proposalVersion: source.proposalVersion, stageNames: current.stages.map((stage) => stage.name) })
      : feedback;
    const result = await reviseTemplateDraft(current, contextualFeedback, { userId: owner.id, organizationId: owner.id, organizationName: owner.name ?? owner.email });
    const validation = validateTemplateDraftQuality({ draft: result.draft, provenance: result.provenance });
    const candidateFormSafety = checkCandidatePublicationSafety(
      result.draft.fields.map((field) => toCandidateFormField(field)),
      { identityRequired: result.draft.identityRequired },
    );
    const generation = await recordTemplateGeneration({
      createdById: owner.id,
      description: source.inputDescription,
      result,
      parentGenerationId: source.id,
      proposalVersion: Math.max(source.proposalVersion + 1, requestedVersion),
      revisionFeedback: feedback,
      changes: result.changes,
      voiceAudit: voiceAudit ? { ...voiceAudit, sourceGenerationId: source.id, proposalVersion: Math.max(source.proposalVersion + 1, requestedVersion) } : null,
    });

    return NextResponse.json({ generationId: generation.id, status: "GENERATED", proposalVersion: generation.proposalVersion, parentGenerationId: source.id, requiresHumanValidation: true, isPublished: false, contactTriggered: false, draft: result.draft, provenance: result.provenance, validation, candidateFormSafety, changes: result.changes, voiceAuditStored: Boolean(voiceAudit) });
  } catch (error) {
    console.error("[ai-template-designer] revision failed", { errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR" });
    return NextResponse.json({ error: "Impossible de réviser la proposition." }, { status: 500 });
  }
}
