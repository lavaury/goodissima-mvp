import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { analyzeTemplateVersionQuality } from "@/lib/ai/template-critic";
import { prisma } from "@/lib/prisma";

function provenanceFromSnapshot(snapshot: Prisma.JsonValue) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const metadata = (snapshot as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const generation = (metadata as Record<string, unknown>).generation;
  return generation && typeof generation === "object" && !Array.isArray(generation)
    ? (generation as Record<string, unknown>)
    : null;
}

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json().catch(() => ({}));
    const requestedVersionId = typeof body.versionId === "string" ? body.versionId : null;
    const formTemplate = await prisma.formTemplate.findUnique({
      where: { id: params.templateId },
      select: { relationTemplateId: true },
    });
    if (!formTemplate?.relationTemplateId) {
      return NextResponse.json({ error: "Parcours introuvable." }, { status: 404 });
    }

    const templateVersion = await prisma.templateVersion.findFirst({
      where: {
        templateId: formTemplate.relationTemplateId,
        ...(requestedVersionId ? { id: requestedVersionId } : {}),
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
    if (!templateVersion) {
      return NextResponse.json({ error: "Aucune version à analyser." }, { status: 404 });
    }

    const report = analyzeTemplateVersionQuality({
      snapshot: templateVersion.snapshot,
      provenance: provenanceFromSnapshot(templateVersion.snapshot),
      isPublished: templateVersion.isPublished,
    });

    const saved = await prisma.$transaction(async (tx) => {
      const criticReport = await tx.templateCriticReport.create({
        data: {
          templateVersionId: templateVersion.id,
          createdById: owner.id,
          criticVersion: report.criticVersion,
          score: report.overallQualityScore,
          report: report as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.aIEvent.create({
        data: {
          provider: "rules",
          model: report.criticVersion,
          action: "template_critic",
          status: "success",
          promptVersion: report.criticVersion,
          outputSummary: `templateVersion=${templateVersion.id};score=${report.overallQualityScore};critical=${report.criticalIssues.length};warnings=${report.warnings.length}`.slice(0, 500),
        },
      });
      return criticReport;
    });

    return NextResponse.json({
      reportId: saved.id,
      templateVersion: { id: templateVersion.id, version: templateVersion.version, isPublished: templateVersion.isPublished },
      report,
    });
  } catch (error) {
    console.error("[template-critic] analysis failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Impossible d'analyser cette version." }, { status: 500 });
  }
}
