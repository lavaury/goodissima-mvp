import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGLinkMatchingState } from "@/lib/glink-matching";
import { allowedMatchingRunActions, MatchingDomainError, type MatchingResultRecord, type MatchingRunAction } from "@/lib/matching-contracts";
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
    select: { id: true, rules: true },
  });
  return link;
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
  try {
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
  } catch (error) {
    console.error("[matching-read] Unexpected route failure", {
      gLinkId: params.linkId,
      error: error instanceof Error ? error.message : "UNKNOWN",
    });
    return NextResponse.json({ error: "MATCHING_READ_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  let lifecycleRequest = false;
  try {
    const source = await linkSource(params.linkId, owner.id);
    if (!source) return NextResponse.json({ error: "MATCHING_SOURCE_NOT_FOUND" }, { status: 404 });
    if (!parseGLinkMatchingState(source.rules).enabled) {
      return NextResponse.json({ error: "MATCHING_DISABLED" }, { status: 409 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const runId = typeof body?.runId === "string" ? body.runId.trim() : "";
    const action = body?.action === "SUSPEND" || body?.action === "RESUME" || body?.action === "CLOSE" ? body.action : null;
    const resultId = typeof body?.resultId === "string" ? body.resultId.trim() : "";
    const decision = body?.decision === "SELECTED" || body?.decision === "DISMISSED" ? body.decision : null;
    const isLifecyclePayload = Boolean(runId && action && !resultId && !decision);
    const isDecisionPayload = Boolean(runId && resultId && decision && !action);
    lifecycleRequest = Boolean(action || body?.action !== undefined);
    if (!isLifecyclePayload && !isDecisionPayload) {
      return NextResponse.json({ error: lifecycleRequest ? "MATCHING_LIFECYCLE_INVALID" : "MATCHING_DECISION_INVALID" }, { status: 400 });
    }

    const lifecycle = new MatchingLifecycleService(createPrismaMatchingRepository(prisma));
    if (isLifecyclePayload) {
      const run = await lifecycle.transitionMatchingRunLifecycle({
        ownerId: owner.id,
        gLinkId: source.id,
        runId,
        action: action as MatchingRunAction,
      });
      return NextResponse.json({ run: publicDetailedRun(run) });
    }
    if (!decision || !resultId) {
      return NextResponse.json({ error: "MATCHING_DECISION_INVALID" }, { status: 400 });
    }
    const decisionRun = await lifecycle.getMatchingRunForOwner({ ownerId: owner.id, runId });
    if (!decisionRun || decisionRun.gLinkId !== source.id) {
      return NextResponse.json({ error: "MATCHING_RUN_NOT_FOUND" }, { status: 404 });
    }
    const result = await lifecycle.transitionMatchingResult({
      ownerId: owner.id,
      runId,
      resultId,
      nextStatus: decision,
    });
    return NextResponse.json({ result: publicResult(result) });
  } catch (error) {
    if (error instanceof MatchingDomainError) {
      return NextResponse.json({ error: error.code }, { status: matchingDecisionHttpStatus(error.code) });
    }
    console.error(lifecycleRequest ? "[matching-lifecycle] Unexpected route failure" : "[matching-decision] Unexpected route failure", {
      gLinkId: params.linkId,
      error: error instanceof Error ? error.message : "UNKNOWN",
    });
    return NextResponse.json({ error: lifecycleRequest ? "MATCHING_LIFECYCLE_FAILED" : "MATCHING_DECISION_FAILED" }, { status: 500 });
  }
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
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    pausedAt: run.pausedAt?.toISOString() ?? null,
    closedAt: run.closedAt?.toISOString() ?? null,
    failureCode: run.failureCode,
    allowedActions: allowedMatchingRunActions(run),
  };
}

function publicDetailedRun(run: Awaited<ReturnType<MatchingLifecycleService["prepareMatchingRun"]>>) {
  return {
    ...publicRun(run),
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
    selectedAt: result.selectedAt?.toISOString() ?? null,
    dismissedAt: result.dismissedAt?.toISOString() ?? null,
  };
}

function matchingDecisionHttpStatus(code: MatchingDomainError["code"]) {
  if (code === "MATCHING_RUN_NOT_FOUND" || code === "MATCHING_RESULT_NOT_FOUND") return 404;
  return 409;
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
