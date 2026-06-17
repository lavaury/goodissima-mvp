import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { generateTemplateOptimizationProposal } from "@/lib/ai/template-optimizer";
import type { TemplateCriticReport } from "@/lib/ai/template-critic";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { templateId: string; reportId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const formTemplate = await prisma.formTemplate.findUnique({
      where: { id: params.templateId },
      select: { relationTemplateId: true },
    });
    if (!formTemplate?.relationTemplateId) return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });

    const criticReport = await prisma.templateCriticReport.findFirst({
      where: {
        id: params.reportId,
        createdById: owner.id,
        templateVersion: { templateId: formTemplate.relationTemplateId },
      },
      include: { templateVersion: true },
    });
    if (!criticReport) return NextResponse.json({ error: "Rapport critique introuvable." }, { status: 404 });

    const proposal = generateTemplateOptimizationProposal({
      snapshot: criticReport.templateVersion.snapshot,
      criticReport: criticReport.report as unknown as TemplateCriticReport,
    });
    const provenance = {
      sourceCriticReportId: criticReport.id,
      sourceTemplateVersionId: criticReport.templateVersionId,
      criticVersion: criticReport.criticVersion,
      optimizerVersion: proposal.optimizerVersion,
      language: "fr",
      generatedAt: proposal.generatedAt,
      generatedByUserId: owner.id,
      mode: "rules",
    };

    const saved = await prisma.$transaction(async (tx) => {
      const optimization = await tx.templateOptimization.create({
        data: {
          criticReportId: criticReport.id,
          sourceVersionId: criticReport.templateVersionId,
          createdById: owner.id,
          optimizerVersion: proposal.optimizerVersion,
          language: "fr",
          originalScore: proposal.originalScore,
          projectedScore: proposal.projectedScore,
          proposal: proposal as unknown as Prisma.InputJsonValue,
          provenance: provenance as Prisma.InputJsonValue,
        },
      });
      await tx.aIEvent.create({
        data: {
          provider: "rules",
          model: proposal.optimizerVersion,
          action: "template_optimization_proposed",
          status: "success",
          promptVersion: proposal.optimizerVersion,
          outputSummary: `optimization=${optimization.id};source=${criticReport.templateVersionId};score=${proposal.originalScore}->${proposal.projectedScore};changes=${proposal.changes.length}`.slice(0, 500),
        },
      });
      return optimization;
    });

    return NextResponse.json({
      optimizationId: saved.id,
      status: "PROPOSED",
      requiresHumanApproval: true,
      proposal,
      provenance,
    });
  } catch (error) {
    console.error("[template-optimizer] proposal failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Impossible de générer la proposition d'optimisation." }, { status: 500 });
  }
}
