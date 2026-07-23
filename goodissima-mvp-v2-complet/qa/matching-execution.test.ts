import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MatchingDomainError,
  type MatchingResultRecord,
  type MatchingRunRecord,
} from "../lib/matching-contracts.ts";
import {
  GLINK_MATCHING_CANDIDATE_LIMIT,
  GLINK_MATCHING_ENGINE_VERSION,
  GLINK_MATCHING_RESULT_LIMIT,
  MatchingExecutionService,
  parseMatchingIdempotencyKey,
  type ExecutableGLinkMatchingSource,
  type GLinkMatchingSourceStore,
} from "../lib/matching/matching-execution-service.ts";
import type { MatchingLifecycleService } from "../lib/matching/matching-lifecycle-service.ts";

const sourceCode = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function source(overrides: Partial<ExecutableGLinkMatchingSource> = {}): ExecutableGLinkMatchingSource {
  return {
    sourceType: "GLINK",
    sourceId: "source",
    ownerId: "owner-1",
    title: "Recherche appartement familial à Paris",
    description: "Budget maximum 1500 euros",
    fields: [
      { label: "Ville recherchée", type: "TEXT" },
      { label: "Budget maximum", type: "NUMBER" },
    ],
    status: "ACTIVE",
    rules: { matchingEnabled: true },
    templateId: "template-1",
    ...overrides,
  };
}

class FakeSourceStore implements GLinkMatchingSourceStore {
  current: ExecutableGLinkMatchingSource | null = source();
  candidates = [
    source({ sourceId: "target-b", title: "Appartement T3 Paris" }),
    source({ sourceId: "target-a", title: "Location appartement Paris" }),
  ];
  requestedLimit = 0;

  async findSourceForOwner(ownerId: string, gLinkId: string) {
    return this.current?.ownerId === ownerId && this.current.sourceId === gLinkId ? this.current : null;
  }

  async listActiveCandidatesForOwner(ownerId: string, excludedGLinkId: string, limit: number) {
    this.requestedLimit = limit;
    return this.candidates
      .filter((candidate) => candidate.ownerId === ownerId && candidate.sourceId !== excludedGLinkId)
      .slice(0, limit);
  }
}

class FakeLifecycle {
  run: MatchingRunRecord | null = null;
  results: MatchingResultRecord[] = [];
  startCount = 0;
  failedCode: string | null = null;
  private sequence = 0;

  async prepareMatchingRun(input: {
    ownerId: string; gLinkId: string; engineVersion: string; criteriaSnapshot: unknown; idempotencyKey?: string;
  }) {
    if (input.idempotencyKey && this.run?.idempotencyKey === input.idempotencyKey) return this.run;
    const now = new Date("2026-07-24T10:00:00.000Z");
    this.run = {
      id: `run-${++this.sequence}`,
      gLinkId: input.gLinkId,
      ownerId: input.ownerId,
      status: "PREPARED",
      isPaused: false,
      engineVersion: input.engineVersion,
      criteriaSnapshot: input.criteriaSnapshot,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      pausedAt: null,
      closedAt: null,
      failureCode: null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.results = [];
    return this.run;
  }

  async startMatchingRun() {
    this.startCount += 1;
    this.run = { ...this.requiredRun(), status: "RUNNING", startedAt: new Date("2026-07-24T10:00:01.000Z") };
    return this.run;
  }

  async createMatchingResults(input: {
    results: Array<{ targetGLinkId: string; explanation: unknown; internalRank?: number }>;
  }) {
    this.results = input.results.map((result, index) => ({
      id: `result-${index + 1}`,
      runId: this.requiredRun().id,
      targetGLinkId: result.targetGLinkId,
      status: "AVAILABLE",
      explanation: result.explanation,
      internalRank: result.internalRank ?? null,
      selectedAt: null,
      dismissedAt: null,
      linkedAt: null,
      relationCaseId: null,
      createdAt: new Date("2026-07-24T10:00:02.000Z"),
      updatedAt: new Date("2026-07-24T10:00:02.000Z"),
    }));
    return this.results;
  }

  async markMatchingResultsAvailable() {
    this.run = { ...this.requiredRun(), status: "RESULTS_AVAILABLE", completedAt: new Date("2026-07-24T10:00:03.000Z") };
    return this.run;
  }

  async failMatchingRun(input: { failureCode: string }) {
    this.failedCode = input.failureCode;
    this.run = { ...this.requiredRun(), status: "FAILED", failureCode: input.failureCode };
    return this.run;
  }

  async getMatchingRunWithResultsForOwner() {
    return this.run ? { run: this.run, results: this.results } : null;
  }

  private requiredRun() {
    if (!this.run) throw new Error("RUN_REQUIRED");
    return this.run;
  }
}

function engineMatch(id: string) {
  return {
    relationId: id,
    explanation: {
      compatibleElements: ["Localisation compatible"],
      semanticSignals: ["Correspondance sémantique"],
      clarificationsNeeded: ["Vérifier les contraintes"],
      warnings: [],
    },
  };
}

function fixture() {
  const lifecycle = new FakeLifecycle();
  const sources = new FakeSourceStore();
  let lexicalCalls = 0;
  let semanticCalls = 0;
  const execution = new MatchingExecutionService({
    lifecycle: lifecycle as unknown as MatchingLifecycleService,
    sources,
    engines: {
      lexical: (_profile, candidates) => {
        lexicalCalls += 1;
        return candidates.map((candidate) => engineMatch(candidate.id));
      },
      semantic: (_profile, candidates) => {
        semanticCalls += 1;
        return candidates.map((candidate) => engineMatch(candidate.id));
      },
    },
  });
  return { lifecycle, sources, execution, calls: () => ({ lexicalCalls, semanticCalls }) };
}

async function expectCode(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: unknown) => error instanceof MatchingDomainError && error.code === code);
}

test("manual execution persists bounded results and completes its run", async () => {
  const { lifecycle, sources, execution, calls } = fixture();
  const response = await execution.execute({ ownerId: "owner-1", gLinkId: "source", idempotencyKey: "manual-1" });
  assert.equal(response.run.status, "RESULTS_AVAILABLE");
  assert.equal(response.results.length, 2);
  assert.ok(response.results.every((result) => result.relationCaseId === null && result.status === "AVAILABLE"));
  assert.deepEqual(response.results.map((result) => result.internalRank), [0, 1]);
  assert.equal(response.results[0]?.explanation && (response.results[0].explanation as { engine: string }).engine, "semantic-v2");
  assert.equal(sources.requestedLimit, GLINK_MATCHING_CANDIDATE_LIMIT);
  assert.deepEqual(calls(), { lexicalCalls: 1, semanticCalls: 1 });
  assert.equal(lifecycle.startCount, 1);
});

test("an execution with no match still persists a completed empty run", async () => {
  const fixtureValue = fixture();
  const execution = new MatchingExecutionService({
    lifecycle: fixtureValue.lifecycle as unknown as MatchingLifecycleService,
    sources: fixtureValue.sources,
    engines: { lexical: () => [], semantic: () => [] },
  });
  const response = await execution.execute({ ownerId: "owner-1", gLinkId: "source" });
  assert.equal(response.run.status, "RESULTS_AVAILABLE");
  assert.deepEqual(response.results, []);
});

test("idempotent available and running runs never execute twice", async () => {
  const available = fixture();
  const first = await available.execution.execute({ ownerId: "owner-1", gLinkId: "source", idempotencyKey: "same-key" });
  const second = await available.execution.execute({ ownerId: "owner-1", gLinkId: "source", idempotencyKey: "same-key" });
  assert.equal(second.run.id, first.run.id);
  assert.deepEqual(second.results.map((result) => result.id), first.results.map((result) => result.id));
  assert.deepEqual(available.calls(), { lexicalCalls: 1, semanticCalls: 1 });

  const running = fixture();
  await running.lifecycle.prepareMatchingRun({
    ownerId: "owner-1",
    gLinkId: "source",
    engineVersion: GLINK_MATCHING_ENGINE_VERSION,
    criteriaSnapshot: {},
    idempotencyKey: "running-key",
  });
  running.lifecycle.run = { ...running.lifecycle.run!, status: "RUNNING" };
  const response = await running.execution.execute({ ownerId: "owner-1", gLinkId: "source", idempotencyKey: "running-key" });
  assert.equal(response.run.status, "RUNNING");
  assert.deepEqual(running.calls(), { lexicalCalls: 0, semanticCalls: 0 });
});

test("source validation is owner-safe and explicit", async () => {
  const foreign = fixture();
  await expectCode(foreign.execution.execute({ ownerId: "owner-2", gLinkId: "source" }), "MATCHING_SOURCE_NOT_FOUND");
  const inactive = fixture();
  inactive.sources.current = source({ status: "ARCHIVED" });
  await expectCode(inactive.execution.execute({ ownerId: "owner-1", gLinkId: "source" }), "MATCHING_SOURCE_INACTIVE");
  const disabled = fixture();
  disabled.sources.current = source({ rules: { matchingEnabled: false } });
  await expectCode(disabled.execution.execute({ ownerId: "owner-1", gLinkId: "source" }), "MATCHING_DISABLED");
  const insufficient = fixture();
  insufficient.sources.current = source({ fields: [] });
  await expectCode(insufficient.execution.execute({ ownerId: "owner-1", gLinkId: "source" }), "MATCHING_CRITERIA_INSUFFICIENT");
});

test("engine failures mark the run FAILED while audit failures stay non-blocking", async () => {
  const failed = fixture();
  const failedAudits: Array<{ candidateCount: number; failureCode?: string }> = [];
  const failingExecution = new MatchingExecutionService({
    lifecycle: failed.lifecycle as unknown as MatchingLifecycleService,
    sources: failed.sources,
    engines: {
      lexical: () => { throw new Error("ENGINE_DOWN"); },
      semantic: () => [],
    },
    audit: async (event) => {
      failedAudits.push({ candidateCount: event.candidateCount, failureCode: event.failureCode });
    },
  });
  await expectCode(failingExecution.execute({ ownerId: "owner-1", gLinkId: "source" }), "MATCHING_EXECUTION_FAILED");
  assert.equal(failed.lifecycle.run?.status, "FAILED");
  assert.equal(failed.lifecycle.failedCode, "GLINK_MATCHING_EXECUTION_FAILED");
  assert.deepEqual(failedAudits, [{
    candidateCount: 2,
    failureCode: "GLINK_MATCHING_EXECUTION_FAILED",
  }]);

  const audit = fixture();
  const auditFailure = new MatchingExecutionService({
    lifecycle: audit.lifecycle as unknown as MatchingLifecycleService,
    sources: audit.sources,
    engines: {
      lexical: (_profile, candidates) => candidates.map((candidate) => engineMatch(candidate.id)),
      semantic: () => [],
    },
    audit: async () => { throw new Error("AUDIT_DOWN"); },
  });
  const successful = await auditFailure.execute({ ownerId: "owner-1", gLinkId: "source" });
  assert.equal(successful.run.status, "RESULTS_AVAILABLE");
});

test("execution contracts keep engine, candidates, results and keys bounded", () => {
  assert.equal(GLINK_MATCHING_ENGINE_VERSION, "glink-v1");
  assert.equal(GLINK_MATCHING_CANDIDATE_LIMIT, 80);
  assert.equal(GLINK_MATCHING_RESULT_LIMIT, 8);
  assert.equal(parseMatchingIdempotencyKey(null), undefined);
  assert.equal(parseMatchingIdempotencyKey(" key-1 "), "key-1");
  assert.throws(() => parseMatchingIdempotencyKey(" "), (error: unknown) => error instanceof MatchingDomainError && error.code === "MATCHING_IDEMPOTENCY_KEY_INVALID");
});

test("Prisma source store and route preserve owner scope and avoid automatic consequences", () => {
  const store = sourceCode("lib/matching/glink-matching-source-store.ts");
  const route = sourceCode("app/api/links/[linkId]/matching/route.ts");
  const execution = sourceCode("lib/matching/matching-execution-service.ts");
  const engineAdapter = sourceCode("lib/matching/glink-matching-engine-adapter.ts");
  assert.match(store, /where: \{ id: gLinkId, ownerId \}/);
  assert.match(store, /where: \{ ownerId, status: "ACTIVE", id: \{ not: excludedGLinkId \} \}/);
  assert.match(store, /orderBy: \{ id: "asc" \}/);
  assert.match(store, /take: limit/);
  assert.match(engineAdapter, /rankMatches/);
  assert.match(engineAdapter, /semanticMatchV2/);
  assert.doesNotMatch(`${store}\n${route}\n${execution}`, /sendEmail|sendMail|notification|invitation|candidateAccessToken|relationCase\.create/i);
  assert.doesNotMatch(route, /serializeGLinkMatchingAnalysis/);
});

test("new matching business files contain no common UTF-8 corruption markers", () => {
  const markers = [
    "\u00c3",
    "\u00c2",
    "\u00e2\u20ac",
    "\u00ef\u00bf\u00bd",
  ];
  for (const path of [
    "lib/matching/matching-execution-service.ts",
    "lib/matching/glink-matching-source-store.ts",
    "lib/matching/glink-matching-engine-adapter.ts",
  ]) {
    const content = sourceCode(path);
    for (const marker of markers) {
      assert.equal(content.includes(marker), false, `${path} contains UTF-8 corruption marker ${JSON.stringify(marker)}`);
    }
  }
});
