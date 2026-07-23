import {
  MatchingDomainError,
  canTransitionMatchingResult,
  canTransitionMatchingRun,
  type MatchingResultRecord,
  type MatchingResultStatus,
  type MatchingRunRecord,
  type MatchingRunStatus,
} from "../matching-contracts.ts";
import type {
  MatchingRepository,
  MatchingResultCreate,
  MatchingRunListPage,
  MatchingRunUpdate,
} from "./matching-repository.ts";
import { isMatchingRunIdempotencyUniqueError } from "./matching-repository.ts";

const MAX_LIST_LIMIT = 100;
const MAX_FAILURE_CODE_LENGTH = 120;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeJson(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") throw new TypeError("MATCHING_JSON_INVALID");
  if (ancestors.has(value)) throw new TypeError("MATCHING_JSON_INVALID");
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("MATCHING_JSON_INVALID");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => normalizeJson(item, ancestors));
    const normalized: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) throw new TypeError("MATCHING_JSON_INVALID");
      normalized[key] = normalizeJson(child, ancestors);
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalMatchingJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalMatchingJson(left) === canonicalMatchingJson(right);
}

function requireRun(run: MatchingRunRecord | null): MatchingRunRecord {
  if (!run) throw new MatchingDomainError("MATCHING_RUN_NOT_FOUND");
  return run;
}

function assertMutableRun(run: MatchingRunRecord) {
  if (run.status === "CLOSED") throw new MatchingDomainError("MATCHING_RUN_CLOSED");
  if (run.isPaused) throw new MatchingDomainError("MATCHING_RUN_PAUSED");
}

function compatiblePreparedRun(
  run: MatchingRunRecord,
  input: { gLinkId: string; engineVersion: string; criteriaSnapshot: unknown },
) {
  return run.gLinkId === input.gLinkId
    && run.engineVersion === input.engineVersion
    && sameJson(run.criteriaSnapshot, input.criteriaSnapshot);
}

export class MatchingLifecycleService {
  private readonly repository: MatchingRepository;
  private readonly now: () => Date;

  constructor(
    repository: MatchingRepository,
    now: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  async prepareMatchingRun(input: {
    ownerId: string;
    gLinkId: string;
    engineVersion: string;
    criteriaSnapshot: unknown;
    idempotencyKey?: string;
  }): Promise<MatchingRunRecord> {
    const criteriaSnapshot = normalizeJson(input.criteriaSnapshot);
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const source = await this.repository.findGLinkForOwner(input.ownerId, input.gLinkId);
    if (!source) throw new MatchingDomainError("MATCHING_SOURCE_NOT_FOUND");

    if (idempotencyKey) {
      const existing = await this.repository.findRunByIdempotencyKey(input.ownerId, idempotencyKey);
      if (existing) {
        if (!compatiblePreparedRun(existing, { ...input, criteriaSnapshot })) {
          throw new MatchingDomainError("MATCHING_IDEMPOTENCY_CONFLICT");
        }
        return existing;
      }
    }

    try {
      return await this.repository.createRun({
        ownerId: input.ownerId,
        gLinkId: input.gLinkId,
        engineVersion: input.engineVersion,
        criteriaSnapshot,
        idempotencyKey,
      });
    } catch (error) {
      if (!idempotencyKey || !isMatchingRunIdempotencyUniqueError(error)) throw error;
      const concurrent = await this.repository.findRunByIdempotencyKey(input.ownerId, idempotencyKey);
      if (!concurrent || !compatiblePreparedRun(concurrent, { ...input, criteriaSnapshot })) {
        throw new MatchingDomainError("MATCHING_IDEMPOTENCY_CONFLICT");
      }
      return concurrent;
    }
  }

  getMatchingRunForOwner(input: { ownerId: string; runId: string }) {
    return this.repository.findRunForOwner(input.ownerId, input.runId);
  }

  getMatchingRunWithResultsForOwner(input: { ownerId: string; runId: string }) {
    return this.repository.findRunWithResultsForOwner(input.ownerId, input.runId);
  }

  async listMatchingRunsForGLink(input: {
    ownerId: string; gLinkId: string; limit?: number; cursor?: string;
  }): Promise<MatchingRunListPage> {
    const limit = Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(input.limit ?? 20)));
    return this.repository.listRunsForGLink(input.ownerId, input.gLinkId, limit, input.cursor);
  }

  async startMatchingRun(input: { ownerId: string; runId: string }) {
    return this.transitionRun(input, "RUNNING", {
      startedAt: this.now(),
      completedAt: null,
      failedAt: null,
      failureCode: null,
    });
  }

  async markMatchingResultsAvailable(input: { ownerId: string; runId: string }) {
    return this.transitionRun(input, "RESULTS_AVAILABLE", {
      completedAt: this.now(),
      failedAt: null,
      failureCode: null,
    });
  }

  async failMatchingRun(input: { ownerId: string; runId: string; failureCode: string }) {
    const failureCode = input.failureCode.trim().slice(0, MAX_FAILURE_CODE_LENGTH);
    if (!failureCode) throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
    return this.transitionRun(input, "FAILED", {
      failedAt: this.now(),
      failureCode,
      completedAt: null,
    });
  }

  async prepareFailedMatchingRun(input: { ownerId: string; runId: string }) {
    return this.transitionRun(input, "PREPARED", {
      startedAt: null,
      completedAt: null,
      failedAt: null,
      failureCode: null,
    });
  }

  async closeMatchingRun(input: { ownerId: string; runId: string }) {
    return this.repository.transaction(async (repository) => {
      const run = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      if (run.status === "CLOSED") return run;
      if (!canTransitionMatchingRun(run, "CLOSED") && !run.isPaused) {
        throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
      }
      if (!["PREPARED", "RESULTS_AVAILABLE", "FAILED"].includes(run.status)) {
        throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
      }
      const updated = await repository.updateRunConditionally({
        ownerId: input.ownerId,
        runId: input.runId,
        expectedStatus: run.status,
        expectedPaused: run.isPaused,
        data: { status: "CLOSED", isPaused: false, pausedAt: null, closedAt: run.closedAt ?? this.now() },
      });
      if (updated) return updated;
      const concurrent = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      if (concurrent.status === "CLOSED") return concurrent;
      throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
    });
  }

  async pauseMatchingRun(input: { ownerId: string; runId: string }) {
    return this.setPaused(input, true);
  }

  async resumeMatchingRun(input: { ownerId: string; runId: string }) {
    return this.setPaused(input, false);
  }

  async createMatchingResults(input: {
    ownerId: string;
    runId: string;
    results: Array<{ targetGLinkId: string; explanation: unknown; internalRank?: number }>;
  }): Promise<MatchingResultRecord[]> {
    return this.repository.transaction(async (repository) => {
      const run = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      assertMutableRun(run);
      if (run.status !== "RUNNING") throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");

      const targetIds = input.results.map((result) => result.targetGLinkId);
      if (new Set(targetIds).size !== targetIds.length) {
        throw new MatchingDomainError("MATCHING_DUPLICATE_RESULT");
      }
      if (targetIds.includes(run.gLinkId)) throw new MatchingDomainError("MATCHING_SELF_TARGET");

      const targets = await repository.findActiveGLinksForOwner(input.ownerId, targetIds);
      if (targets.length !== targetIds.length) throw new MatchingDomainError("MATCHING_TARGET_NOT_FOUND");

      const normalized: MatchingResultCreate[] = input.results.map((result, index) => ({
        targetGLinkId: result.targetGLinkId,
        explanation: normalizeJson(result.explanation),
        internalRank: result.internalRank ?? index,
      }));
      const existing = await repository.findResultsForTargets(input.ownerId, input.runId, targetIds);
      this.assertCompatibleResults(existing, normalized);
      await repository.createMissingResults(input.ownerId, input.runId, normalized);
      const persisted = await repository.findResultsForTargets(input.ownerId, input.runId, targetIds);
      this.assertCompatibleResults(persisted, normalized);
      if (persisted.length !== normalized.length) throw new MatchingDomainError("MATCHING_DUPLICATE_RESULT");
      return persisted;
    });
  }

  async transitionMatchingResult(input: {
    ownerId: string;
    runId: string;
    resultId: string;
    nextStatus: Exclude<MatchingResultStatus, "LINKED">;
  }): Promise<MatchingResultRecord> {
    return this.repository.transaction(async (repository) => {
      const run = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      assertMutableRun(run);
      const result = await repository.findResultForOwner(input.ownerId, input.runId, input.resultId);
      if (!result) throw new MatchingDomainError("MATCHING_RESULT_NOT_FOUND");
      if (input.nextStatus === result.status) return result;
      if (!canTransitionMatchingResult(run, result.status, input.nextStatus)) {
        throw new MatchingDomainError("MATCHING_INVALID_RESULT_TRANSITION");
      }

      const now = this.now();
      const data = input.nextStatus === "SELECTED"
        ? { status: input.nextStatus, selectedAt: now, dismissedAt: null, linkedAt: null }
        : input.nextStatus === "DISMISSED"
          ? { status: input.nextStatus, selectedAt: null, dismissedAt: now, linkedAt: null }
          : { status: input.nextStatus, selectedAt: null, dismissedAt: null, linkedAt: null };
      const updated = await repository.updateResultConditionally({
        ownerId: input.ownerId,
        runId: input.runId,
        resultId: input.resultId,
        expectedStatus: result.status,
        expectedRunStatus: run.status,
        data,
      });
      if (!updated) throw new MatchingDomainError("MATCHING_INVALID_RESULT_TRANSITION");
      return updated;
    });
  }

  private async transitionRun(
    input: { ownerId: string; runId: string },
    nextStatus: MatchingRunStatus,
    data: MatchingRunUpdate,
  ) {
    return this.repository.transaction(async (repository) => {
      const run = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      assertMutableRun(run);
      if (!canTransitionMatchingRun(run, nextStatus)) {
        throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
      }
      const updated = await repository.updateRunConditionally({
        ownerId: input.ownerId,
        runId: input.runId,
        expectedStatus: run.status,
        expectedPaused: false,
        data: { ...data, status: nextStatus },
      });
      if (!updated) throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
      return updated;
    });
  }

  private async setPaused(input: { ownerId: string; runId: string }, isPaused: boolean) {
    return this.repository.transaction(async (repository) => {
      const run = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      if (run.status === "CLOSED") throw new MatchingDomainError("MATCHING_RUN_CLOSED");
      if (run.isPaused === isPaused) return run;
      const updated = await repository.updateRunConditionally({
        ownerId: input.ownerId,
        runId: input.runId,
        expectedStatus: run.status,
        expectedPaused: run.isPaused,
        data: { isPaused, pausedAt: isPaused ? this.now() : null },
      });
      if (updated) return updated;
      const concurrent = requireRun(await repository.findRunForOwner(input.ownerId, input.runId));
      if (concurrent.isPaused === isPaused) return concurrent;
      throw new MatchingDomainError("MATCHING_INVALID_RUN_TRANSITION");
    });
  }

  private assertCompatibleResults(existing: MatchingResultRecord[], requested: MatchingResultCreate[]) {
    const byTarget = new Map(requested.map((result) => [result.targetGLinkId, result]));
    for (const result of existing) {
      const expected = byTarget.get(result.targetGLinkId);
      if (!expected
        || result.internalRank !== expected.internalRank
        || !sameJson(result.explanation, expected.explanation)) {
        throw new MatchingDomainError("MATCHING_DUPLICATE_RESULT");
      }
    }
  }
}
