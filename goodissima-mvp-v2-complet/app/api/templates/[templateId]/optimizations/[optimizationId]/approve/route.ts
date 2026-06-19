import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import type { TemplateOptimizationProposal } from "@/lib/ai/template-optimizer";
import { parseTemplateSnapshot } from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { templateId: string; optimizationId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    if (body.humanApproved !== true) {
      return NextResponse.json({ error: "Une approbation humaine explicite est requise." }, { status: 400 });
    }

    const formTemplate = await prisma.formTemplate.findUnique({
      where: { id: params.templateId },
      select: { relationTemplateId: true },
    });
    if (!formTemplate?.relationTemplateId) return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });

    const optimization = await prisma.templateOptimization.findFirst({
      where: {
        id: params.optimizationId,
        createdById: owner.id,
        status: "PROPOSED",
        sourceVersion: { templateId: formTemplate.relationTemplateId },
      },
      include: { sourceVersion: true },
    });
    if (!optimization) return NextResponse.json({ error: "Proposition introuvable ou déjà traitée." }, { status: 404 });

    const proposal = optimization.proposal as unknown as TemplateOptimizationProposal;
    const optimizedSnapshot = parseTemplateSnapshot(proposal.optimizedSnapshot as Prisma.JsonValue);
    if (!optimizedSnapshot || proposal.language !== "fr") {
      return NextResponse.json({ error: "La proposition enregistrée est invalide." }, { status: 422 });
    }

    const lastVersion = await prisma.templateVersion.findFirst({
      where: { templateId: formTemplate.relationTemplateId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (lastVersion?.version ?? 0) + 1;
    const approvedAt = new Date();
    const snapshot = {
      ...optimizedSnapshot,
      metadata: {
        ...optimizedSnapshot.metadata,
        snapshotVersion: 2,
        lifecycle: "DRAFT",
        optimization: {
          id: optimization.id,
          sourceVersionId: optimization.sourceVersionId,
          criticReportId: optimization.criticReportId,
          optimizerVersion: optimization.optimizerVersion,
          language: optimization.language,
          originalScore: optimization.originalScore,
          projectedScore: optimization.projectedScore,
          changes: proposal.changes,
          approvedAt: approvedAt.toISOString(),
          approvedByUserId: owner.id,
        },
      },
    };

    const draftVersion = await prisma.$transaction(async (tx) => {
      const created = await tx.templateVersion.create({
        data: {
          templateId: formTemplate.relationTemplateId!,
          version,
          name: optimizedSnapshot.relationTemplate.name,
          description: optimizedSnapshot.relationTemplate.description,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          isPublished: false,
        },
      });
      await tx.templateOptimization.update({
        where: { id: optimization.id },
        data: { status: "APPROVED", approvedAt, draftVersionId: created.id },
      });
      await tx.aIEvent.create({
        data: {
          provider: "human",
          model: optimization.optimizerVersion,
          action: "template_optimization_approved",
          status: "success",
          promptVersion: optimization.optimizerVersion,
          outputSummary: `optimization=${optimization.id};source=${optimization.sourceVersionId};draftVersion=${created.id};version=${version}`.slice(0, 500),
        },
      });
      return created;
    });

    return NextResponse.json({
      status: "APPROVED",
      templateVersion: { id: draftVersion.id, version: draftVersion.version, isPublished: false },
      sourceVersionUnchanged: true,
    }, { status: 201 });
  } catch (error) {
    console.error("[template-optimizer] approval failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Impossible de créer le brouillon d'optimisation." }, { status: 500 });
  }
}
