import test from "node:test";
import assert from "node:assert/strict";
import {
  MatchingDomainError,
  type MatchingResultRecord,
  type MatchingRunRecord,
} from "../lib/matching-contracts.ts";
import { MatchingLifecycleService } from "../lib/matching/matching-lifecycle-service.ts";
import type {
  MatchingGLinkRecord,
  MatchingRepository,
  MatchingResultCreate,
  MatchingResultUpdate,
  MatchingRunCreate,
  MatchingRunListPage,
  MatchingRunUpdate,
} from "../lib/matching/matching-repository.ts";
import { MatchingRunIdempotencyUniqueError } from "../lib/matching/matching-repository.ts";

class MemoryMatchingRepository implements MatchingRepository {
  links = new Map<string, MatchingGLinkRecord>();
  runs = new Map<string, MatchingRunRecord>();
  results = new Map<string, MatchingResultRecord>();
  writes = 0;
  private sequence = 0;

  async transaction<T>(operation: (repository: MatchingRepository) => Promise<T>) {
    return operation(this);
  }

  async findGLinkForOwner(ownerId: string, gLinkId: string) {
    const link = this.links.get(gLinkId);
    return link?.ownerId === ownerId ? link : null;
  }

  async findActiveGLinksForOwner(ownerId: string, gLinkIds: string[]) {
    return gLinkIds
      .map((id) => this.links.get(id))
      .filter((link): link is MatchingGLinkRecord => link?.ownerId === ownerId && link.status === "ACTIVE")
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async findRunForOwner(ownerId: string, runId: string) {
    const run = this.runs.get(runId);
    return run?.ownerId === ownerId ? run : null;
  }

  async findRunByIdempotencyKey(ownerId: string, idempotencyKey: string) {
    return [...this.runs.values()].find((run) => run.ownerId === ownerId && run.idempotencyKey === idempotencyKey) ?? null;
  }

  async findRunWithResultsForOwner(ownerId: string, runId: string) {
    const run = await this.findRunForOwner(ownerId, runId);
    if (!run) return null;
    return {
      run,
      results: [...this.results.values()]
        .filter((result) => result.runId === runId)
        .sort(compareResults),
    };
  }

  async listRunsForGLink(ownerId: string, gLinkId: string, limit: number, cursor?: string): Promise<MatchingRunListPage> {
    const all = [...this.runs.values()]
      .filter((run) => run.ownerId === ownerId && run.gLinkId === gLinkId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
    const start = cursor ? Math.max(0, all.findIndex((run) => run.id === cursor) + 1) : 0;
    const items = all.slice(start, start + limit);
    return { items, nextCursor: all.length > start + limit ? items.at(-1)?.id ?? null : null };
  }

  async createRun(input: MatchingRunCreate) {
    if (input.idempotencyKey && await this.findRunByIdempotencyKey(input.ownerId, input.idempotencyKey)) {
      throw new MatchingRunIdempotencyUniqueError();
    }
    const now = new Date("2026-07-23T10:00:00.000Z");
    const run: MatchingRunRecord = {
      id: `run-${++this.sequence}`,
      ...input,
      status: "PREPARED",
      isPaused: false,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      pausedAt: null,
      closedAt: null,
      failureCode: null,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    this.writes += 1;
    return run;
  }

  async updateRunConditionally(input: {
    ownerId: string; runId: string; expectedStatus: MatchingRunRecord["status"];
    expectedPaused: boolean; data: MatchingRunUpdate;
  }) {
    const run = await this.findRunForOwner(input.ownerId, input.runId);
    if (!run || run.status !== input.expectedStatus || run.isPaused !== input.expectedPaused) return null;
    const updated = { ...run, ...input.data, updatedAt: new Date("2026-07-23T10:00:00.000Z") };
    this.runs.set(run.id, updated);
    this.writes += 1;
    return updated;
  }

  async findResultsForTargets(ownerId: string, runId: string, targetGLinkIds: string[]) {
    if (!await this.findRunForOwner(ownerId, runId)) return [];
    return [...this.results.values()]
      .filter((result) => result.runId === runId && targetGLinkIds.includes(result.targetGLinkId))
      .sort(compareResults);
  }

  async createMissingResults(ownerId: string, runId: string, results: MatchingResultCreate[]) {
    if (!await this.findRunForOwner(ownerId, runId)) return;
    for (const input of results) {
      if ([...this.results.values()].some((result) => result.runId === runId && result.targetGLinkId === input.targetGLinkId)) continue;
      const now = new Date("2026-07-23T10:00:00.000Z");
      const result: MatchingResultRecord = {
        id: `result-${++this.sequence}`,
        runId,
        ...input,
        status: "AVAILABLE",
        selectedAt: null,
        dismissedAt: null,
        linkedAt: null,
        relationCaseId: null,
        createdAt: now,
        updatedAt: now,
      };
      this.results.set(result.id, result);
      this.writes += 1;
    }
  }

  async findResultForOwner(ownerId: string, runId: string, resultId: string) {
    if (!await this.findRunForOwner(ownerId, runId)) return null;
    const result = this.results.get(resultId);
    return result?.runId === runId ? result : null;
  }

  async updateResultConditionally(input: {
    ownerId: string; runId: string; resultId: string;
    expectedStatus: MatchingResultRecord["status"]; expectedRunStatus: MatchingRunRecord["status"];
    data: MatchingResultUpdate;
  }) {
    const run = await this.findRunForOwner(input.ownerId, input.runId);
    const result = await this.findResultForOwner(input.ownerId, input.runId, input.resultId);
    if (!run || !result || run.status !== input.expectedRunStatus || run.isPaused || result.status !== input.expectedStatus) return null;
    const updated = { ...result, ...input.data, updatedAt: new Date("2026-07-23T10:00:00.000Z") };
    this.results.set(result.id, updated);
    this.writes += 1;
    return updated;
  }
}

function compareResults(left: MatchingResultRecord, right: MatchingResultRecord) {
  return (left.internalRank ?? Number.MAX_SAFE_INTEGER) - (right.internalRank ?? Number.MAX_SAFE_INTEGER)
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id);
}

function fixture() {
  const repository = new MemoryMatchingRepository();
  repository.links.set("source", { id: "source", ownerId: "owner-1", status: "ACTIVE" });
  repository.links.set("target-a", { id: "target-a", ownerId: "owner-1", status: "ACTIVE" });
  repository.links.set("target-b", { id: "target-b", ownerId: "owner-1", status: "ACTIVE" });
  repository.links.set("foreign", { id: "foreign", ownerId: "owner-2", status: "ACTIVE" });
  const service = new MatchingLifecycleService(repository, () => new Date("2026-07-23T12:00:00.000Z"));
  return { repository, service };
}

async function expectCode(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: unknown) => error instanceof MatchingDomainError && error.code === code);
}

test("preparation is owner-scoped, canonical and idempotent", async () => {
  const { repository, service } = fixture();
  const input = {
    ownerId: "owner-1",
    gLinkId: "source",
    engineVersion: "v2",
    criteriaSnapshot: { city: "Paris", filters: { b: 2, a: 1 } },
    idempotencyKey: "request-1",
  };
  const first = await service.prepareMatchingRun(input);
  const second = await service.prepareMatchingRun({
    ...input,
    criteriaSnapshot: { filters: { a: 1, b: 2 }, city: "Paris" },
  });
  assert.equal(first.id, second.id);
  assert.equal(repository.writes, 1);
  await expectCode(service.prepareMatchingRun({ ...input, engineVersion: "v3" }), "MATCHING_IDEMPOTENCY_CONFLICT");
  const withoutKeyA = await service.prepareMatchingRun({ ...input, idempotencyKey: undefined });
  const withoutKeyB = await service.prepareMatchingRun({ ...input, idempotencyKey: undefined });
  assert.notEqual(withoutKeyA.id, withoutKeyB.id);
  await expectCode(service.prepareMatchingRun({ ...input, gLinkId: "missing" }), "MATCHING_SOURCE_NOT_FOUND");
  await expectCode(service.prepareMatchingRun({ ...input, ownerId: "owner-2" }), "MATCHING_SOURCE_NOT_FOUND");
  assert.equal(await service.getMatchingRunForOwner({ ownerId: "owner-2", runId: first.id }), null);
});

test("concurrent idempotency violations are classified without masking technical errors", async () => {
  const compatible = fixture();
  const compatibleCreate = compatible.repository.createRun.bind(compatible.repository);
  compatible.repository.createRun = async (input) => {
    await compatibleCreate(input);
    throw new MatchingRunIdempotencyUniqueError();
  };
  const compatibleRun = await compatible.service.prepareMatchingRun({
    ownerId: "owner-1",
    gLinkId: "source",
    engineVersion: "v2",
    criteriaSnapshot: { filters: { b: 2, a: 1 } },
    idempotencyKey: "concurrent-compatible",
  });
  assert.equal(compatibleRun.engineVersion, "v2");

  const incompatible = fixture();
  const incompatibleCreate = incompatible.repository.createRun.bind(incompatible.repository);
  incompatible.repository.createRun = async (input) => {
    const run = await incompatibleCreate(input);
    incompatible.repository.runs.set(run.id, { ...run, engineVersion: "other-version" });
    throw new MatchingRunIdempotencyUniqueError();
  };
  await expectCode(incompatible.service.prepareMatchingRun({
    ownerId: "owner-1",
    gLinkId: "source",
    engineVersion: "v2",
    criteriaSnapshot: {},
    idempotencyKey: "concurrent-incompatible",
  }), "MATCHING_IDEMPOTENCY_CONFLICT");

  const technical = fixture();
  const technicalError = new Error("DATABASE_UNAVAILABLE");
  technical.repository.createRun = async () => {
    throw technicalError;
  };
  await assert.rejects(
    technical.service.prepareMatchingRun({
      ownerId: "owner-1",
      gLinkId: "source",
      engineVersion: "v2",
      criteriaSnapshot: {},
      idempotencyKey: "technical-error",
    }),
    (error: unknown) => error === technicalError,
  );
});

test("run lifecycle validates transitions, timestamps, pause and idempotent close", async () => {
  const { repository, service } = fixture();
  const run = await service.prepareMatchingRun({
    ownerId: "owner-1", gLinkId: "source", engineVersion: "v2", criteriaSnapshot: {},
  });
  const running = await service.startMatchingRun({ ownerId: "owner-1", runId: run.id });
  assert.equal(running.status, "RUNNING");
  assert.ok(running.startedAt);
  const failed = await service.failMatchingRun({ ownerId: "owner-1", runId: run.id, failureCode: "ENGINE_TIMEOUT" });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.failureCode, "ENGINE_TIMEOUT");
  const prepared = await service.prepareFailedMatchingRun({ ownerId: "owner-1", runId: run.id });
  assert.equal(prepared.startedAt, null);
  const paused = await service.pauseMatchingRun({ ownerId: "owner-1", runId: run.id });
  const writesAfterPause = repository.writes;
  assert.equal(paused.status, "PREPARED");
  assert.equal(paused.isPaused, true);
  assert.equal((await service.pauseMatchingRun({ ownerId: "owner-1", runId: run.id })).isPaused, true);
  assert.equal(repository.writes, writesAfterPause);
  await expectCode(service.startMatchingRun({ ownerId: "owner-1", runId: run.id }), "MATCHING_RUN_PAUSED");
  assert.equal((await service.resumeMatchingRun({ ownerId: "owner-1", runId: run.id })).status, "PREPARED");
  await service.startMatchingRun({ ownerId: "owner-1", runId: run.id });
  await service.markMatchingResultsAvailable({ ownerId: "owner-1", runId: run.id });
  const closed = await service.closeMatchingRun({ ownerId: "owner-1", runId: run.id });
  const writesAfterClose = repository.writes;
  assert.equal(closed.status, "CLOSED");
  assert.equal((await service.closeMatchingRun({ ownerId: "owner-1", runId: run.id })).closedAt?.toISOString(), closed.closedAt?.toISOString());
  assert.equal(repository.writes, writesAfterClose);
  await expectCode(service.resumeMatchingRun({ ownerId: "owner-1", runId: run.id }), "MATCHING_RUN_CLOSED");
});

test("result creation is atomic in scope, deterministic and idempotent", async () => {
  const { service } = fixture();
  const run = await service.prepareMatchingRun({
    ownerId: "owner-1", gLinkId: "source", engineVersion: "v2", criteriaSnapshot: {},
  });
  await expectCode(service.createMatchingResults({
    ownerId: "owner-1", runId: run.id, results: [{ targetGLinkId: "target-a", explanation: {} }],
  }), "MATCHING_INVALID_RUN_TRANSITION");
  await service.startMatchingRun({ ownerId: "owner-1", runId: run.id });
  await expectCode(service.createMatchingResults({
    ownerId: "owner-1", runId: run.id, results: [{ targetGLinkId: "source", explanation: {} }],
  }), "MATCHING_SELF_TARGET");
  await expectCode(service.createMatchingResults({
    ownerId: "owner-1", runId: run.id, results: [{ targetGLinkId: "foreign", explanation: {} }],
  }), "MATCHING_TARGET_NOT_FOUND");
  await expectCode(service.createMatchingResults({
    ownerId: "owner-1",
    runId: run.id,
    results: [
      { targetGLinkId: "target-a", explanation: {} },
      { targetGLinkId: "target-a", explanation: {} },
    ],
  }), "MATCHING_DUPLICATE_RESULT");

  const input = [
    { targetGLinkId: "target-b", explanation: { signals: ["B"] }, internalRank: 2 },
    { targetGLinkId: "target-a", explanation: { signals: ["A"] }, internalRank: 1 },
  ];
  const created = await service.createMatchingResults({ ownerId: "owner-1", runId: run.id, results: input });
  assert.deepEqual(created.map((result) => result.targetGLinkId), ["target-a", "target-b"]);
  assert.ok(created.every((result) => result.status === "AVAILABLE" && result.relationCaseId === null));
  const repeated = await service.createMatchingResults({ ownerId: "owner-1", runId: run.id, results: input });
  assert.deepEqual(repeated.map((result) => result.id), created.map((result) => result.id));
  await expectCode(service.createMatchingResults({
    ownerId: "owner-1",
    runId: run.id,
    results: [{ targetGLinkId: "target-a", explanation: { changed: true }, internalRank: 1 }],
  }), "MATCHING_DUPLICATE_RESULT");
});

test("result decisions are persistent-result scoped and LINKED is not exposed", async () => {
  const { service } = fixture();
  const run = await service.prepareMatchingRun({
    ownerId: "owner-1", gLinkId: "source", engineVersion: "v2", criteriaSnapshot: {},
  });
  await service.startMatchingRun({ ownerId: "owner-1", runId: run.id });
  const [result] = await service.createMatchingResults({
    ownerId: "owner-1", runId: run.id, results: [{ targetGLinkId: "target-a", explanation: {} }],
  });
  const selected = await service.transitionMatchingResult({
    ownerId: "owner-1", runId: run.id, resultId: result.id, nextStatus: "SELECTED",
  });
  assert.equal(selected.status, "SELECTED");
  assert.ok(selected.selectedAt);
  const available = await service.transitionMatchingResult({
    ownerId: "owner-1", runId: run.id, resultId: result.id, nextStatus: "AVAILABLE",
  });
  assert.equal(available.selectedAt, null);
  const dismissed = await service.transitionMatchingResult({
    ownerId: "owner-1", runId: run.id, resultId: result.id, nextStatus: "DISMISSED",
  });
  assert.ok(dismissed.dismissedAt);
  await expectCode(service.transitionMatchingResult({
    ownerId: "owner-1", runId: run.id, resultId: "target-a", nextStatus: "SELECTED",
  }), "MATCHING_RESULT_NOT_FOUND");
  await service.pauseMatchingRun({ ownerId: "owner-1", runId: run.id });
  await expectCode(service.transitionMatchingResult({
    ownerId: "owner-1", runId: run.id, resultId: result.id, nextStatus: "AVAILABLE",
  }), "MATCHING_RUN_PAUSED");
});
