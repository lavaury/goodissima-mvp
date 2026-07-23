import {
  hasUsefulGLinkMatchingCriteria,
  matchingProfileFromSource,
  type RelationalMatchingSource,
} from "../ai/relational-matching-source.ts";
import type { AIMatchCandidate } from "../ai/matching.ts";
import { parseGLinkMatchingState } from "../glink-matching.ts";
import {
  MatchingDomainError,
  type MatchingResultRecord,
  type MatchingRunRecord,
} from "../matching-contracts.ts";
import { MatchingLifecycleService } from "./matching-lifecycle-service.ts";

export const GLINK_MATCHING_ENGINE_VERSION = "glink-v1";
export const GLINK_MATCHING_CANDIDATE_LIMIT = 80;
export const GLINK_MATCHING_RESULT_LIMIT = 8;
export const GLINK_MATCHING_IDEMPOTENCY_KEY_MAX_LENGTH = 160;

type GLinkSource = Extract<RelationalMatchingSource, { sourceType: "GLINK" }>;

export type ExecutableGLinkMatchingSource = GLinkSource & {
  status: string;
  rules: unknown;
  templateId: string | null;
};

export type GLinkMatchingSourceStore = {
  findSourceForOwner(ownerId: string, gLinkId: string): Promise<ExecutableGLinkMatchingSource | null>;
  listActiveCandidatesForOwner(
    ownerId: string,
    excludedGLinkId: string,
    limit: number,
  ): Promise<GLinkSource[]>;
};

export type PersistableMatchingExplanation = {
  summary: string;
  signals: string[];
  cautions?: string[];
  engine: string;
};

export type MatchingExecutionResponse = {
  run: MatchingRunRecord;
  results: MatchingResultRecord[];
  executed: boolean;
  candidateCount: number;
  durationMs: number;
};

type EngineMatch = {
  relationId: string;
  explanation: {
    compatibleElements: string[];
    semanticSignals?: string[];
    clarificationsNeeded: string[];
    warnings: string[];
  };
};

export type GLinkMatchingEngines = {
  lexical(source: ReturnType<typeof matchingProfileFromSource>, candidates: AIMatchCandidate[]): EngineMatch[];
  semantic(source: ReturnType<typeof matchingProfileFromSource>, candidates: AIMatchCandidate[]): EngineMatch[];
};

export type MatchingExecutionAudit = (input: {
  runId: string;
  gLinkId: string;
  engineVersion: string;
  durationMs: number;
  candidateCount: number;
  resultCount: number;
  failureCode?: string;
}) => Promise<void>;

function boundedText(value: string, maximum: number) {
  return value.trim().slice(0, maximum);
}

function uniqueBounded(values: string[], maximumItems: number) {
  return Array.from(new Set(values.map((value) => boundedText(value, 180)).filter(Boolean))).slice(0, maximumItems);
}

function persistableExplanation(match: EngineMatch, engine: string): PersistableMatchingExplanation {
  const signals = uniqueBounded([
    ...match.explanation.compatibleElements,
    ...(match.explanation.semanticSignals ?? []),
  ], 6);
  const cautions = uniqueBounded([
    ...match.explanation.clarificationsNeeded,
    ...match.explanation.warnings,
  ], 4);
  return {
    summary: boundedText(signals[0] ?? "Correspondance potentielle à examiner.", 240),
    signals,
    ...(cautions.length ? { cautions } : {}),
    engine,
  };
}

export function parseMatchingIdempotencyKey(value: string | null): string | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > GLINK_MATCHING_IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new MatchingDomainError("MATCHING_IDEMPOTENCY_KEY_INVALID");
  }
  return normalized;
}

export class MatchingExecutionService {
  private readonly lifecycle: MatchingLifecycleService;
  private readonly sources: GLinkMatchingSourceStore;
  private readonly engines: GLinkMatchingEngines;
  private readonly audit?: MatchingExecutionAudit;
  private readonly now: () => number;

  constructor(input: {
    lifecycle: MatchingLifecycleService;
    sources: GLinkMatchingSourceStore;
    engines: GLinkMatchingEngines;
    audit?: MatchingExecutionAudit;
    now?: () => number;
  }) {
    this.lifecycle = input.lifecycle;
    this.sources = input.sources;
    this.engines = input.engines;
    this.audit = input.audit;
    this.now = input.now ?? (() => Date.now());
  }

  async execute(input: {
    ownerId: string;
    gLinkId: string;
    idempotencyKey?: string;
  }): Promise<MatchingExecutionResponse> {
    const startedAt = this.now();
    const source = await this.sources.findSourceForOwner(input.ownerId, input.gLinkId);
    if (!source) throw new MatchingDomainError("MATCHING_SOURCE_NOT_FOUND");
    if (source.status !== "ACTIVE") throw new MatchingDomainError("MATCHING_SOURCE_INACTIVE");
    if (!parseGLinkMatchingState(source.rules).enabled) throw new MatchingDomainError("MATCHING_DISABLED");
    if (!source.templateId || !hasUsefulGLinkMatchingCriteria(source)) {
      throw new MatchingDomainError("MATCHING_CRITERIA_INSUFFICIENT");
    }

    const sourceProfile = matchingProfileFromSource(source);
    const criteriaSnapshot = {
      sourceId: source.sourceId,
      profile: sourceProfile,
      engineVersion: GLINK_MATCHING_ENGINE_VERSION,
      searchScope: {
        ownerOnly: true,
        activeOnly: true,
        excludeSource: true,
        candidateLimit: GLINK_MATCHING_CANDIDATE_LIMIT,
        resultLimit: GLINK_MATCHING_RESULT_LIMIT,
        order: "id-asc",
      },
    };
    const prepared = await this.lifecycle.prepareMatchingRun({
      ownerId: input.ownerId,
      gLinkId: input.gLinkId,
      engineVersion: GLINK_MATCHING_ENGINE_VERSION,
      criteriaSnapshot,
      idempotencyKey: input.idempotencyKey,
    });

    if (prepared.isPaused) throw new MatchingDomainError("MATCHING_RUN_PAUSED");
    if (prepared.status === "RUNNING") {
      const current = await this.requireRunWithResults(input.ownerId, prepared.id);
      return this.response(current.run, current.results, false, 0, startedAt);
    }
    if (prepared.status === "RESULTS_AVAILABLE" || prepared.status === "FAILED" || prepared.status === "CLOSED") {
      const current = await this.requireRunWithResults(input.ownerId, prepared.id);
      return this.response(current.run, current.results, false, 0, startedAt);
    }

    const running = await this.lifecycle.startMatchingRun({ ownerId: input.ownerId, runId: prepared.id });
    let loadedCandidateCount = 0;
    try {
      const candidateSources = await this.sources.listActiveCandidatesForOwner(
        input.ownerId,
        input.gLinkId,
        GLINK_MATCHING_CANDIDATE_LIMIT,
      );
      loadedCandidateCount = candidateSources.length;
      const candidates: AIMatchCandidate[] = candidateSources.map((candidate, index) => ({
        id: candidate.sourceId,
        pseudonym: `Opportunité compatible ${index + 1}`,
        templateKey: null,
        profile: matchingProfileFromSource(candidate),
      }));
      const lexical = this.engines.lexical(sourceProfile, candidates);
      const semantic = this.engines.semantic(sourceProfile, candidates);
      const selectedEngine = semantic.length ? "semantic-v2" : "lexical-v1";
      const matches = (semantic.length ? semantic : lexical).slice(0, GLINK_MATCHING_RESULT_LIMIT);
      await this.lifecycle.createMatchingResults({
        ownerId: input.ownerId,
        runId: running.id,
        results: matches.map((match, index) => ({
          targetGLinkId: match.relationId,
          internalRank: index,
          explanation: persistableExplanation(match, selectedEngine),
        })),
      });
      await this.lifecycle.markMatchingResultsAvailable({ ownerId: input.ownerId, runId: running.id });
      const persisted = await this.requireRunWithResults(input.ownerId, running.id);
      const durationMs = Math.max(0, this.now() - startedAt);
      await this.auditSafely({
        runId: running.id,
        gLinkId: input.gLinkId,
        engineVersion: GLINK_MATCHING_ENGINE_VERSION,
        durationMs,
        candidateCount: candidates.length,
        resultCount: persisted.results.length,
      });
      return {
        run: persisted.run,
        results: persisted.results,
        executed: true,
        candidateCount: candidates.length,
        durationMs,
      };
    } catch (error) {
      const failureCode = "GLINK_MATCHING_EXECUTION_FAILED";
      try {
        await this.lifecycle.failMatchingRun({
          ownerId: input.ownerId,
          runId: running.id,
          failureCode,
        });
      } catch (finalizationError) {
        console.error("[matching] Unable to mark run failed", {
          runId: running.id,
          gLinkId: input.gLinkId,
          failureCode,
          error: finalizationError instanceof Error ? finalizationError.message : "UNKNOWN",
        });
      }
      await this.auditSafely({
        runId: running.id,
        gLinkId: input.gLinkId,
        engineVersion: GLINK_MATCHING_ENGINE_VERSION,
        durationMs: Math.max(0, this.now() - startedAt),
        candidateCount: loadedCandidateCount,
        resultCount: 0,
        failureCode,
      });
      console.error("[matching] Persistent execution failed", {
        runId: running.id,
        gLinkId: input.gLinkId,
        engineVersion: GLINK_MATCHING_ENGINE_VERSION,
        failureCode,
        error: error instanceof Error ? error.message : "UNKNOWN",
      });
      throw new MatchingDomainError("MATCHING_EXECUTION_FAILED");
    }
  }

  private async requireRunWithResults(ownerId: string, runId: string) {
    const value = await this.lifecycle.getMatchingRunWithResultsForOwner({ ownerId, runId });
    if (!value) throw new MatchingDomainError("MATCHING_RUN_NOT_FOUND");
    return value;
  }

  private response(
    run: MatchingRunRecord,
    results: MatchingResultRecord[],
    executed: boolean,
    candidateCount: number,
    startedAt: number,
  ): MatchingExecutionResponse {
    return {
      run,
      results,
      executed,
      candidateCount,
      durationMs: Math.max(0, this.now() - startedAt),
    };
  }

  private async auditSafely(input: Parameters<MatchingExecutionAudit>[0]) {
    if (!this.audit) return;
    try {
      await this.audit(input);
    } catch (error) {
      console.warn("[matching] Audit event unavailable", {
        runId: input.runId,
        failureCode: input.failureCode,
        error: error instanceof Error ? error.message : "UNKNOWN",
      });
    }
  }
}
