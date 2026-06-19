import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { validateTemplateDraftQuality } from "@/lib/ai/template-draft-quality";
import { assertEditableDraftVersion, buildManualJourneyVersionPlan, changedJourneyFields, manualJourneyChanges, parseEditableJourneyDesign } from "@/lib/manual-journey-editor";
import { prisma } from "@/lib/prisma";
import { parseTemplateSnapshot } from "@/lib/template-snapshots";

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const sourceVersionId = typeof body.sourceVersionId === "string" ? body.sourceVersionId : "";
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 1000) : null;

    const formTemplate = await prisma.formTemplate.findUnique({ where: { id: params.templateId }, select: { relationTemplateId: true } });
    if (!formTemplate?.relationTemplateId) return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });

    const sourceVersion = await prisma.templateVersion.findFirst({ where: { id: sourceVersionId, templateId: formTemplate.relationTemplateId } });
    if (!sourceVersion) return NextResponse.json({ error: "Version source introuvable." }, { status: 404 });
    const sourceSnapshot = parseTemplateSnapshot(sourceVersion.snapshot);
    if (!sourceSnapshot?.design) return NextResponse.json({ error: "Cette version ne contient aucune conception modifiable." }, { status: 422 });

    try {
      assertEditableDraftVersion({ isPublished: sourceVersion.isPublished, snapshot: sourceSnapshot });
    } catch (error) {
      const code = error instanceof Error ? error.message : "VERSION_PROTECTED";
      return NextResponse.json({ error: code === "PUBLISHED_VERSION_PROTECTED" ? "Une version publiée est protégée et ne peut pas être modifiée." : "Seule une version DRAFT non publiée peut être modifiée." }, { status: 409 });
    }

    const previousDesign = parseEditableJourneyDesign(sourceSnapshot.design);
    const design = parseEditableJourneyDesign(body.design);
    const changes = manualJourneyChanges(previousDesign, design);
    const changedFields = changedJourneyFields(changes);
    if (changedFields.length === 0) return NextResponse.json({ error: "Aucune modification à enregistrer." }, { status: 400 });

    const validation = validateTemplateDraftQuality({
      draft: { name: sourceSnapshot.relationTemplate.name, ...design, fields: sourceSnapshot.fields, isPublished: false },
      requireProvenance: false,
      requireUnpublished: true,
    });
    if (!validation.valid) return NextResponse.json({ error: "Le Quality Guard a détecté des erreurs critiques.", validation }, { status: 422 });

    const createdAt = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.templateVersion.findFirst({ where: { templateId: formTemplate.relationTemplateId! }, orderBy: { version: "desc" }, select: { version: true } });
      const version = (latest?.version ?? 0) + 1;
      const plan = buildManualJourneyVersionPlan({ sourceVersion: { id: sourceVersion.id, version: sourceVersion.version, isPublished: sourceVersion.isPublished }, newVersion: version, userId: owner.id, sourceSnapshot: sourceSnapshot as unknown as Record<string, unknown> & { metadata: Record<string, unknown> }, previousDesign, design, reason, timestamp: createdAt.toISOString() });
      const snapshot = { ...plan.snapshot, metadata: { ...plan.snapshot.metadata, qualityGuard: { version: "template-draft-quality-v1", valid: validation.valid, warnings: validation.warnings } } };
      const newVersion = await tx.templateVersion.create({
        data: { templateId: formTemplate.relationTemplateId!, version, name: sourceVersion.name, description: sourceVersion.description, snapshot: snapshot as unknown as Prisma.InputJsonValue, isPublished: false },
      });
      const audit = await tx.manualTemplateEditAudit.create({
        data: { userId: owner.id, sourceVersionId: sourceVersion.id, newVersionId: newVersion.id, changeType: "MANUAL_JOURNEY_EDIT", changedFields: changedFields as Prisma.InputJsonValue, reason },
      });
      return { newVersion, audit };
    });

    return NextResponse.json({
      templateVersion: { id: result.newVersion.id, version: result.newVersion.version, isPublished: false },
      previousVersion: sourceVersion.version,
      changes,
      validation,
      audit: { id: result.audit.id, userId: result.audit.userId, sourceVersionId: result.audit.sourceVersionId, newVersionId: result.audit.newVersionId, changeType: result.audit.changeType, changedFields: result.audit.changedFields, reason: result.audit.reason, timestamp: result.audit.createdAt.toISOString() },
      safety: { published: false, workflowsExecuted: false, participantsContacted: false, activeRelationshipsModified: false },
    }, { status: 201 });
  } catch (error) {
    console.error("[manual-journey-editor] save failed", { errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR" });
    return NextResponse.json({ error: "Impossible d'enregistrer la nouvelle version du parcours." }, { status: 500 });
  }
}
