import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { parseTemplateDesignerDraft } from "@/lib/ai/template-designer";
import { validateTemplateDraftQuality } from "@/lib/ai/template-draft-quality";
import { candidateFieldsFromTemplateDraft, candidateIdentityRequiredFromTemplateDraft, checkCandidatePublicationSafety, toCandidateFormField } from "@/lib/candidate-form-safety";
import { prisma } from "@/lib/prisma";
import { buildPersistedOpportunityPresentation } from "@/lib/opportunity-preview";

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 68) || "PARCOURS_IA";
}

export async function POST(req: Request, { params }: { params: { generationId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    if (body.humanValidated !== true) {
      return NextResponse.json({ error: "Une validation humaine explicite est requise." }, { status: 400 });
    }

    const generation = await prisma.templateGeneration.findFirst({
      where: { id: params.generationId, createdById: owner.id },
    });
    if (!generation) return NextResponse.json({ error: "Génération introuvable." }, { status: 404 });
    if (generation.status !== "GENERATED") {
      return NextResponse.json({ error: "Cette génération a déjà été validée." }, { status: 409 });
    }

    const submittedDraft = body.draft ?? generation.output;
    const preValidationSafety = checkCandidatePublicationSafety(
      candidateFieldsFromTemplateDraft(submittedDraft),
      { identityRequired: candidateIdentityRequiredFromTemplateDraft(submittedDraft) },
    );
    if (!preValidationSafety.publishable) {
      return NextResponse.json(
        { error: preValidationSafety.error, candidateFormSafety: preValidationSafety },
        { status: 422 },
      );
    }

    const validation = validateTemplateDraftQuality({
      draft: submittedDraft,
      provenance: {
        provider: generation.provider,
        model: generation.model,
        promptVersion: generation.promptVersion,
        language: generation.language,
        generatedAt: generation.createdAt.toISOString(),
      },
    });
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Le brouillon contient des erreurs critiques.", validation },
        { status: 422 },
      );
    }

    const draft = parseTemplateDesignerDraft(submittedDraft);
    const candidateFormSafety = checkCandidatePublicationSafety(
      draft.fields.map((field) => toCandidateFormField(field)),
      { identityRequired: draft.identityRequired },
    );
    if (!candidateFormSafety.publishable) {
      return NextResponse.json(
        { error: candidateFormSafety.error, candidateFormSafety, validation },
        { status: 422 },
      );
    }
    const presentation = body.presentation && typeof body.presentation === "object" && !Array.isArray(body.presentation)
      ? body.presentation as Record<string, unknown>
      : {};
    const opportunityPresentation = buildPersistedOpportunityPresentation({
      presentation,
      generatedCategory: draft.opportunityCategory,
      source: generation.inputDescription,
    });
    const baseKey = normalizeKey(typeof body.key === "string" && body.key.trim() ? body.key : draft.name);
    let key = baseKey;
    let suffix = 1;
    while (
      (await prisma.relationTemplate.findUnique({ where: { key }, select: { id: true } })) ||
      (await prisma.formTemplate.findUnique({ where: { key: `${key}_FORM`.slice(0, 80) }, select: { id: true } }))
    ) {
      suffix += 1;
      key = `${baseKey}_${suffix}`.slice(0, 80);
    }
    const formKey = `${key}_FORM`.slice(0, 80);

    const template = await prisma.$transaction(async (tx) => {
      const relationTemplate = await tx.relationTemplate.create({
        data: { key, name: draft.name, description: draft.description, status: "DRAFT", aiInstructions: typeof body.aiInstructions === "string" && body.aiInstructions.trim() ? body.aiInstructions.trim().slice(0, 5000) : null },
      });
      const formTemplate = await tx.formTemplate.create({
        data: { key: formKey, name: draft.name, description: draft.description, relationTemplateId: relationTemplate.id },
      });
      if (draft.fields.length > 0) {
        await tx.formField.createMany({
          data: draft.fields.map((field, index) => ({
            formTemplateId: formTemplate.id,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            step: field.step,
            position: index + 1,
            placeholder: field.placeholder,
          })),
        });
      }

      const fields = draft.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder ?? null,
        defaultValue: null,
        step: field.step,
        options: null,
        conditionalRules: null,
        validationRules: null,
      }));
      await tx.templateVersion.create({
        data: {
          templateId: relationTemplate.id,
          version: 1,
          name: draft.name,
          description: draft.description,
          isPublished: false,
          snapshot: {
            relationTemplate: { id: relationTemplate.id, key, name: draft.name, description: draft.description },
            formTemplate: { id: formTemplate.id, key: formKey, name: draft.name, description: draft.description },
            fields,
            design: {
              actors: draft.actors,
              stages: draft.stages,
              documents: draft.documents,
              relationalRequests: draft.relationalRequests,
              kpis: draft.kpis,
            },
            metadata: {
              snapshotVersion: 2,
              identityRequired: draft.identityRequired,
              lifecycle: "DRAFT",
              humanValidated: true,
              qualityGuard: {
                version: "template-draft-quality-v1",
                valid: validation.valid,
                warnings: validation.warnings,
              },
              candidateFormSafety: {
                statusLabel: candidateFormSafety.statusLabel,
                publishable: candidateFormSafety.publishable,
                checkedAt: new Date().toISOString(),
              },
              generation: {
                id: generation.id,
                parentGenerationId: generation.parentGenerationId,
                proposalVersion: generation.proposalVersion,
                revisionFeedback: generation.revisionFeedback,
                changes: generation.changes,
                provider: generation.provider,
                model: generation.model,
                promptVersion: generation.promptVersion,
                language: generation.language,
                inputDescription: generation.inputDescription,
                generatedAt: generation.createdAt.toISOString(),
                validatedAt: new Date().toISOString(),
                validatedByUserId: owner.id,
              },
              opportunityPresentation,
            },
          } as Prisma.InputJsonValue,
        },
      });
      await tx.templateGeneration.update({
        where: { id: generation.id },
        data: { status: "VALIDATED", validatedAt: new Date(), templateId: relationTemplate.id, output: draft as unknown as Prisma.InputJsonValue },
      });
      if (generation.aiEventId) {
        await tx.aIEvent.update({
          where: { id: generation.aiEventId },
          data: { templateId: relationTemplate.id },
        });
      }
      return formTemplate;
    });

    return NextResponse.json(
      { templateId: template.id, status: "DRAFT", version: 1, isPublished: false, validation, candidateFormSafety },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ai-template-designer] validation failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Impossible de créer le brouillon validé." }, { status: 500 });
  }
}
