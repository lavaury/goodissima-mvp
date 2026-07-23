import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import type { RelationalMatchingSource } from "@/lib/ai/relational-matching-source";
import { prisma } from "@/lib/prisma";
import { parseGLinkMatchingState } from "@/lib/glink-matching";
import { MatchingDomainError, type MatchingResultRecord } from "@/lib/matching-contracts";
import { MatchingLifecycleService } from "@/lib/matching/matching-lifecycle-service";
import {
  GLINK_MATCHING_ENGINE_VERSION,
  MatchingExecutionService,
  parseMatchingIdempotencyKey,
  type PersistableMatchingExplanation,
} from "@/lib/matching/matching-execution-service";
import { createPrismaMatchingRepository } from "@/lib/matching/matching-repository";
import { PrismaGLinkMatchingSourceStore } from "@/lib/matching/glink-matching-source-store";
import { glinkMatchingEngines } from "@/lib/matching/glink-matching-engine-adapter";

async function linkSource(linkId: string, ownerId: string) {
  const link = await prisma.gLink.findFirst({
    where: { id: linkId, ownerId, status: "ACTIVE" },
    select: {
      id: true, ownerId: true, title: true, description: true, templateId: true, rules: true,
      template: {
        select: {
          formTemplates: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { fields: { orderBy: [{ step: "asc" }, { position: "asc" }], select: { label: true, type: true, options: true, validationRules: true } } },
          },
        },
      },
    },
  });
  if (!link) return null;
  const source: Extract<RelationalMatchingSource, { sourceType: "GLINK" }> = {
    sourceType: "GLINK", sourceId: link.id, ownerId: link.ownerId, title: link.title,
    description: link.description, fields: link.template?.formTemplates[0]?.fields ?? [],
  };
  return { link, source };
}

export async function POST(request: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  try {
    const idempotencyKey = await readIdempotencyKey(request);
    const lifecycle = new MatchingLifecycleService(createPrismaMatchingRepository(prisma));
    const execution = new MatchingExecutionService({
      lifecycle,
      sources: new PrismaGLinkMatchingSourceStore(prisma),
      engines: glinkMatchingEngines,
      audit: async (event) => {
        await prisma.aIEvent.create({
          data: {
            organizationId: owner.id,
            featureName: "matching_analysis",
            provider: "goodissima",
            model: GLINK_MATCHING_ENGINE_VERSION,
            action: "glink_matching_analysis",
            status: event.failureCode ? "error" : "success",
            promptVersion: GLINK_MATCHING_ENGINE_VERSION,
            outputSummary: JSON.stringify({
              runId: event.runId,
              resultCount: event.resultCount,
              candidateCount: event.candidateCount,
              engineVersion: event.engineVersion,
              durationMs: event.durationMs,
              failureCode: event.failureCode,
            }),
          },
        });
      },
    });
    const response = await execution.execute({
      ownerId: owner.id,
      gLinkId: params.linkId,
      idempotencyKey,
    });
    return NextResponse.json({
      run: publicRun(response.run),
      results: response.results.map(publicResult),
      matches: response.results.map(legacyMatch),
      warnings: [],
    });
  } catch (error) {
    if (error instanceof MatchingDomainError) {
      return NextResponse.json({ error: error.code }, { status: matchingHttpStatus(error.code) });
    }
    console.error("[matching] Unexpected route failure", {
      gLinkId: params.linkId,
      error: error instanceof Error ? error.message : "UNKNOWN",
    });
    return NextResponse.json({ error: "MATCHING_EXECUTION_FAILED" }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const source = await new PrismaGLinkMatchingSourceStore(prisma).findSourceForOwner(owner.id, params.linkId);
  if (!source) return NextResponse.json({ error: "MATCHING_SOURCE_NOT_FOUND" }, { status: 404 });
  const lifecycle = new MatchingLifecycleService(createPrismaMatchingRepository(prisma));
  const persisted = await lifecycle.getLatestMatchingRunWithResultsForGLink({
    ownerId: owner.id,
    gLinkId: params.linkId,
  });
  return NextResponse.json({
    enabled: parseGLinkMatchingState(source.rules).enabled,
    run: persisted ? publicDetailedRun(persisted.run) : null,
    results: persisted?.results.map(publicResult) ?? [],
  });
}

export async function PATCH(request: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const resolved = await linkSource(params.linkId, owner.id);
  if (!resolved?.link.templateId) return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  if (!parseGLinkMatchingState(resolved.link.rules).enabled) {
    return NextResponse.json({ error: "MATCHING_DISABLED" }, { status: 409 });
  }
  const body = await request.json();
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const decision = body.decision === "INTERESTING" ? "INTERESTING" : body.decision === "IGNORED" ? "IGNORED" : null;
  if (!targetId || !decision) return NextResponse.json({ error: "Décision invalide" }, { status: 400 });
  const persistedTarget = await prisma.matchingResult.findFirst({
    where: {
      targetGLinkId: targetId,
      run: { ownerId: owner.id, gLinkId: resolved.link.id, status: "RESULTS_AVAILABLE" },
    },
    select: { id: true },
    orderBy: { run: { createdAt: "desc" } },
  });
  if (!persistedTarget) return NextResponse.json({ error: "MATCHING_RESULT_NOT_FOUND" }, { status: 404 });
  // Legacy audit-only decision. Structured MatchingResult transitions remain reserved for Lot 5.
  await prisma.aIEvent.create({
    data: {
      templateId: resolved.link.templateId, organizationId: owner.id, featureName: "matching_analysis",
      provider: "human", model: "human-review", action: decision === "INTERESTING" ? "glink_matching_interested" : "glink_matching_ignored",
      status: "success", promptVersion: "matching-v1.1-glink",
      outputSummary: JSON.stringify({ sourceType: "GLINK", sourceId: resolved.link.id, targetId, decision }),
    },
  });
  return NextResponse.json({ ok: true });
}

async function readIdempotencyKey(request: Request) {
  const header = request.headers.get("Idempotency-Key");
  if (header !== null) return parseMatchingIdempotencyKey(header);
  if (!request.headers.get("content-type")?.includes("application/json")) return undefined;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (body.idempotencyKey === undefined) return undefined;
  if (typeof body.idempotencyKey !== "string") {
    throw new MatchingDomainError("MATCHING_IDEMPOTENCY_KEY_INVALID");
  }
  return parseMatchingIdempotencyKey(body.idempotencyKey);
}

function publicRun(run: Awaited<ReturnType<MatchingLifecycleService["prepareMatchingRun"]>>) {
  return {
    id: run.id,
    status: run.status,
    isPaused: run.isPaused,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    failureCode: run.failureCode,
  };
}

function publicDetailedRun(run: Awaited<ReturnType<MatchingLifecycleService["prepareMatchingRun"]>>) {
  return {
    ...publicRun(run),
    startedAt: run.startedAt?.toISOString() ?? null,
    failedAt: run.failedAt?.toISOString() ?? null,
  };
}

function publicResult(result: MatchingResultRecord) {
  return {
    id: result.id,
    targetGLinkId: result.targetGLinkId,
    status: result.status,
    explanation: result.explanation,
    internalRank: result.internalRank,
  };
}

function legacyMatch(result: MatchingResultRecord, index: number) {
  const explanation = result.explanation as Partial<PersistableMatchingExplanation>;
  return {
    relationId: result.targetGLinkId,
    pseudonym: `Opportunité compatible ${index + 1}`,
    explanation: {
      compatibleElements: Array.isArray(explanation.signals) ? explanation.signals : [],
      semanticSignals: [],
      clarificationsNeeded: Array.isArray(explanation.cautions) ? explanation.cautions : [],
      warnings: [],
    },
  };
}

function matchingHttpStatus(code: MatchingDomainError["code"]) {
  if (code === "MATCHING_SOURCE_NOT_FOUND" || code === "MATCHING_RUN_NOT_FOUND") return 404;
  if (code === "MATCHING_CRITERIA_INSUFFICIENT") return 422;
  if (code === "MATCHING_IDEMPOTENCY_KEY_INVALID") return 400;
  if (code === "MATCHING_EXECUTION_FAILED") return 500;
  return 409;
}
