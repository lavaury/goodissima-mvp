import type { PrismaClient } from "@prisma/client";
import { MatchingDomainError, type MatchingResultRecord, type MatchingRunRecord } from "../matching-contracts.ts";
import type { OpportunityType } from "../opportunities/contracts.ts";
import {
  buildMatchableOpportunityProjection,
  structuredOpportunityMatchingConsent,
  type MatchableOpportunityProjectionV1,
} from "../opportunities/matching/matchable-projection.ts";
import { OPPORTUNITY_COMPARATOR_POLICY_VERSION, OPPORTUNITY_STRUCTURED_ENGINE_VERSION, rankStructuredOpportunityMatches } from "../opportunities/matching/structured-matcher.ts";
import type { MatchableOpportunityCandidateRepository } from "./cross-owner-opportunity-candidate-repository.ts";
import type { MatchingResultViewV1 } from "./matching-result-view.ts";
import { projectMatchingResultView } from "./matching-result-view.ts";
import {
  MATCHING_CACHE_TTL_MS,
  consumeMatchingRateLimits,
  isCrossOwnerMatchingEnabled,
  matchingCriteriaFingerprintHash,
  matchingRateLimitEntries,
} from "./matching-safety.ts";
import {
  acquireMatchingExecutionLease,
  findReusableMatchingRun,
  releaseMatchingExecutionLease,
} from "./matching-safety-repository.ts";

const CROSS_OWNER_CANDIDATE_LIMIT = 80;
const CROSS_OWNER_RESULT_LIMIT = 5;

export type MatchableOpportunitySourceV1 = {
  internalSourceRef: string;
  internalOwnerRef: string;
  projection: MatchableOpportunityProjectionV1;
};

export type MatchableOpportunitySourceRepository = {
  findEligibleSourceForOwner(ownerId: string, sourceId: string): Promise<MatchableOpportunitySourceV1 | null>;
};

type CrossOwnerLifecycle = {
  prepareMatchingRun(input: { ownerId: string; gLinkId: string; engineVersion: string; criteriaSnapshot: unknown; idempotencyKey?: string; criteriaFingerprintHash?: string; cacheValidUntil?: Date }): Promise<MatchingRunRecord>;
  startMatchingRun(input: { ownerId: string; runId: string }): Promise<MatchingRunRecord>;
  createCrossOwnerMatchingResults(input: {
    ownerId: string; runId: string; expectedSourceProjection: MatchableOpportunityProjectionV1;
    results: Array<{ internalTargetRef: string; expectedProjection: MatchableOpportunityProjectionV1; explanation: unknown; internalRank?: number }>;
  }): Promise<MatchingResultRecord[]>;
  markMatchingResultsAvailable(input: { ownerId: string; runId: string }): Promise<MatchingRunRecord>;
  failMatchingRun(input: { ownerId: string; runId: string; failureCode: string }): Promise<MatchingRunRecord>;
  getRevalidatedCrossOwnerRunWithResults(input: { ownerId: string; runId: string }): Promise<{ run: MatchingRunRecord; results: MatchingResultRecord[]; invalidatedResultIds: string[] }>;
  transitionCrossOwnerMatchingResult(input: { ownerId: string; runId: string; resultId: string; nextStatus: "SELECTED" | "DISMISSED" }): Promise<MatchingResultRecord>;
};

export type CrossOwnerOpportunityMatchingOutput = {
  runId: string;
  results: MatchingResultViewV1[];
};

type CrossOwnerSafety = {
  consume(input: { userId: string; ownerId: string; opportunityId: string }, now: Date): Promise<{ allowed: true } | { allowed: false }>;
  findReusable(input: { ownerId: string; gLinkId: string; criteriaFingerprintHash: string; now: Date }): Promise<MatchingRunRecord | null>;
  acquire(input: { ownerId: string; gLinkId: string; criteriaFingerprintHash: string; now: Date }): Promise<{ acquired: true; leaseId: string } | { acquired: false }>;
  release(input: { leaseId: string; ownerId: string; gLinkId: string; criteriaFingerprintHash: string }): Promise<unknown>;
};

export type CrossOwnerMatchingMetric = {
  outcome: "requested" | "executed" | "cache_reused" | "throttled" | "failed" | "invalidated_result";
  durationMs?: number;
  resultCountBucket?: "0" | "1-2" | "3-5";
};

export function crossOwnerMatchingPublicFailure(error: unknown) {
  if (error instanceof MatchingDomainError && error.code === "MATCHING_THROTTLED") {
    return { status: 429, body: { error: "MATCHING_THROTTLED" as const } };
  }
  if (error instanceof MatchingDomainError && error.code === "MATCHING_EXECUTION_IN_PROGRESS") {
    return { status: 409, body: { error: "MATCHING_RETRY_LATER" as const } };
  }
  if (error instanceof MatchingDomainError && (error.code === "MATCHING_DISABLED" || error.code === "MATCHING_PROTECTION_UNAVAILABLE")) {
    return { status: 503, body: { error: "MATCHING_UNAVAILABLE" as const } };
  }
  return { status: 404, body: { error: "MATCHING_UNAVAILABLE" as const } };
}

export class PrismaCrossOwnerMatchingSafety implements CrossOwnerSafety {
  private readonly client: PrismaClient;
  constructor(client: PrismaClient) { this.client = client; }
  consume(input: { userId: string; ownerId: string; opportunityId: string }, now: Date) {
    return consumeMatchingRateLimits(this.client, matchingRateLimitEntries(input), now);
  }
  findReusable(input: { ownerId: string; gLinkId: string; criteriaFingerprintHash: string; now: Date }) {
    return findReusableMatchingRun(this.client, input) as unknown as Promise<MatchingRunRecord | null>;
  }
  acquire(input: { ownerId: string; gLinkId: string; criteriaFingerprintHash: string; now: Date }) {
    return acquireMatchingExecutionLease(this.client, input);
  }
  release(input: { leaseId: string; ownerId: string; gLinkId: string; criteriaFingerprintHash: string }) {
    return releaseMatchingExecutionLease(this.client, input);
  }
}

export class PrismaMatchableOpportunitySourceRepository implements MatchableOpportunitySourceRepository {
  private readonly client: Pick<PrismaClient, "gLink">;

  constructor(client: Pick<PrismaClient, "gLink">) {
    this.client = client;
  }

  async findEligibleSourceForOwner(ownerId: string, sourceId: string): Promise<MatchableOpportunitySourceV1 | null> {
    const row = await this.client.gLink.findFirst({
      where: { id: sourceId, ownerId, status: "ACTIVE" },
      select: { id: true, ownerId: true, status: true, rules: true },
    });
    if (!row || row.status !== "ACTIVE" || structuredOpportunityMatchingConsent(row.rules) !== "ENABLED") return null;
    const projection = buildMatchableOpportunityProjection({ rules: row.rules });
    return projection ? { internalSourceRef: row.id, internalOwnerRef: row.ownerId, projection } : null;
  }
}

export class CrossOwnerOpportunityMatchingService {
  private readonly sources: MatchableOpportunitySourceRepository;
  private readonly candidates: MatchableOpportunityCandidateRepository;
  private readonly lifecycle: CrossOwnerLifecycle;
  private readonly enabled: () => boolean;
  private readonly safety: CrossOwnerSafety;
  private readonly metric: (event: CrossOwnerMatchingMetric) => void;
  private readonly now: () => Date;

  constructor(
    sources: MatchableOpportunitySourceRepository,
    candidates: MatchableOpportunityCandidateRepository,
    lifecycle: CrossOwnerLifecycle,
    enabled: () => boolean = isCrossOwnerMatchingEnabled,
    safety: CrossOwnerSafety = unavailableSafety,
    metric: (event: CrossOwnerMatchingMetric) => void = () => undefined,
    now: () => Date = () => new Date(),
  ) {
    this.sources = sources;
    this.candidates = candidates;
    this.lifecycle = lifecycle;
    this.safety = safety;
    this.enabled = enabled;
    this.metric = metric;
    this.now = now;
  }

  async execute(input: { userId?: string; ownerId: string; sourceId: string; idempotencyKey?: string }): Promise<CrossOwnerOpportunityMatchingOutput> {
    const startedAt = this.now();
    this.recordMetric({ outcome: "requested" });
    if (!this.enabled()) throw new MatchingDomainError("MATCHING_DISABLED");
    const source = await this.sources.findEligibleSourceForOwner(input.ownerId, input.sourceId);
    if (!source || source.internalOwnerRef !== input.ownerId) throw new MatchingDomainError("MATCHING_SOURCE_NOT_FOUND");
    try {
      const quota = await this.safety.consume({ userId: input.userId ?? input.ownerId, ownerId: input.ownerId, opportunityId: source.internalSourceRef }, startedAt);
      if (!quota.allowed) {
        this.recordMetric({ outcome: "throttled" });
        throw new MatchingDomainError("MATCHING_THROTTLED");
      }
    } catch (error) {
      if (error instanceof MatchingDomainError) throw error;
      this.recordMetric({ outcome: "failed" });
      throw new MatchingDomainError("MATCHING_PROTECTION_UNAVAILABLE");
    }
    const criteriaFingerprintHash = matchingCriteriaFingerprintHash({
      projection: source.projection,
      engineVersion: OPPORTUNITY_STRUCTURED_ENGINE_VERSION,
      comparatorPolicyVersion: OPPORTUNITY_COMPARATOR_POLICY_VERSION,
    });
    let cached: MatchingRunRecord | null;
    try {
      cached = await this.safety.findReusable({ ownerId: input.ownerId, gLinkId: source.internalSourceRef, criteriaFingerprintHash, now: startedAt });
    } catch {
      this.recordMetric({ outcome: "failed" });
      throw new MatchingDomainError("MATCHING_PROTECTION_UNAVAILABLE");
    }
    if (cached) {
      const persisted = await this.lifecycle.getRevalidatedCrossOwnerRunWithResults({ ownerId: input.ownerId, runId: cached.id });
      if (persisted.invalidatedResultIds.length === 0) {
        const replay = projectCrossOwnerRun(persisted.run, persisted.results);
        this.recordMetric({ outcome: "cache_reused", durationMs: this.now().getTime() - startedAt.getTime(), resultCountBucket: resultCountBucket(replay.results.length) });
        return replay;
      }
      this.recordMetric({ outcome: "invalidated_result" });
    }
    let leaseId: string | null = null;
    try {
      const lease = await this.safety.acquire({ ownerId: input.ownerId, gLinkId: source.internalSourceRef, criteriaFingerprintHash, now: startedAt });
      if (lease.acquired) leaseId = lease.leaseId;
    } catch {
      throw new MatchingDomainError("MATCHING_PROTECTION_UNAVAILABLE");
    }
    if (!leaseId) throw new MatchingDomainError("MATCHING_EXECUTION_IN_PROGRESS");
    const snapshot = {
      engineVersion: OPPORTUNITY_STRUCTURED_ENGINE_VERSION,
      scope: "CROSS_OWNER_V1",
      matchingConsent: "EXPLICIT",
      projectionVersion: source.projection.schemaVersion,
      sourceType: source.projection.opportunityType,
      criteria: source.projection,
      comparatorPolicyVersion: OPPORTUNITY_COMPARATOR_POLICY_VERSION,
    };
    let run: MatchingRunRecord | null = null;
    let startedByThisRequest = false;
    try {
      run = await this.lifecycle.prepareMatchingRun({ ownerId: input.ownerId, gLinkId: source.internalSourceRef, engineVersion: OPPORTUNITY_STRUCTURED_ENGINE_VERSION, criteriaSnapshot: snapshot, idempotencyKey: input.idempotencyKey, criteriaFingerprintHash, cacheValidUntil: new Date(startedAt.getTime() + MATCHING_CACHE_TTL_MS) });
      if (run.status === "RESULTS_AVAILABLE") {
        const replay = await this.lifecycle.getRevalidatedCrossOwnerRunWithResults({ ownerId: input.ownerId, runId: run.id });
        const output = projectCrossOwnerRun(replay.run, replay.results);
        this.recordMetric({ outcome: "cache_reused", durationMs: this.now().getTime() - startedAt.getTime(), resultCountBucket: resultCountBucket(output.results.length) });
        return output;
      }
      if (run.status === "RUNNING") throw new MatchingDomainError("MATCHING_EXECUTION_IN_PROGRESS");
      await this.lifecycle.startMatchingRun({ ownerId: input.ownerId, runId: run.id });
      startedByThisRequest = true;
      const complementaryType: OpportunityType = source.projection.opportunityType === "NEED" ? "OFFER" : "NEED";
      const discovered = await this.candidates.listEligibleCandidates({ sourceId: source.internalSourceRef, sourceOwnerId: source.internalOwnerRef, complementaryType, limit: CROSS_OWNER_CANDIDATE_LIMIT });
      const defended = discovered.filter((candidate) => candidate.internalOwnerRef !== source.internalOwnerRef);
      const matches = rankStructuredOpportunityMatches(
        { id: source.internalSourceRef, ownerId: source.internalOwnerRef, status: "ACTIVE", matchingConsent: "EXPLICIT", projection: source.projection },
        defended.map((candidate) => ({ id: candidate.internalTargetRef, ownerId: candidate.internalOwnerRef, status: "ACTIVE", matchingConsent: "EXPLICIT", projection: candidate.projection })),
        "CROSS_OWNER_V1",
      ).slice(0, CROSS_OWNER_RESULT_LIMIT);
      const byTarget = new Map(defended.map((candidate) => [candidate.internalTargetRef, candidate]));
      const persisted = await this.lifecycle.createCrossOwnerMatchingResults({
        ownerId: input.ownerId,
        runId: run.id,
        expectedSourceProjection: source.projection,
        results: matches.map((match, index) => ({
          internalTargetRef: match.targetGLinkId,
          expectedProjection: byTarget.get(match.targetGLinkId)!.projection,
          explanation: match.explanation,
          internalRank: index,
        })),
      });
      await this.lifecycle.markMatchingResultsAvailable({ ownerId: input.ownerId, runId: run.id });
      this.recordMetric({ outcome: "executed", durationMs: this.now().getTime() - startedAt.getTime(), resultCountBucket: resultCountBucket(persisted.length) });
      return {
        runId: run.id,
        results: persisted.map((result, index) => projectMatchingResultView({ result, sourceType: source.projection.opportunityType, ordinal: index + 1 })),
      };
    } catch (error) {
      if (startedByThisRequest && run) await this.lifecycle.failMatchingRun({ ownerId: input.ownerId, runId: run.id, failureCode: "CROSS_OWNER_MATCHING_EXECUTION_FAILED" }).catch(() => undefined);
      this.recordMetric({ outcome: "failed" });
      if (error instanceof MatchingDomainError && error.code === "MATCHING_EXECUTION_IN_PROGRESS") throw error;
      throw new MatchingDomainError("MATCHING_EXECUTION_FAILED");
    } finally {
      await this.safety.release({ leaseId, ownerId: input.ownerId, gLinkId: source.internalSourceRef, criteriaFingerprintHash }).catch(() => undefined);
    }
  }

  async read(input: { ownerId: string; runId: string }): Promise<CrossOwnerOpportunityMatchingOutput> {
    if (!this.enabled()) throw new MatchingDomainError("MATCHING_DISABLED");
    const persisted = await this.lifecycle.getRevalidatedCrossOwnerRunWithResults(input);
    if (persisted.invalidatedResultIds.length > 0) this.recordMetric({ outcome: "invalidated_result" });
    return projectCrossOwnerRun(persisted.run, persisted.results);
  }

  async decide(input: { ownerId: string; runId: string; resultId: string; decision: "SELECTED" | "DISMISSED" }) {
    if (!this.enabled()) throw new MatchingDomainError("MATCHING_DISABLED");
    const result = await this.lifecycle.transitionCrossOwnerMatchingResult({ ...input, nextStatus: input.decision });
    const persisted = await this.lifecycle.getRevalidatedCrossOwnerRunWithResults({ ownerId: input.ownerId, runId: input.runId });
    const sourceType = snapshotSourceType(persisted.run.criteriaSnapshot);
    if (!sourceType) throw new MatchingDomainError("MATCHING_RESULT_UNAVAILABLE");
    const ordinal = persisted.results.findIndex((item) => item.id === result.id) + 1;
    if (ordinal < 1 || ordinal > CROSS_OWNER_RESULT_LIMIT) throw new MatchingDomainError("MATCHING_RESULT_UNAVAILABLE");
    return projectMatchingResultView({ result, sourceType, ordinal });
  }

  private recordMetric(event: CrossOwnerMatchingMetric) {
    try { this.metric(event); } catch { /* Metrics must never alter matching control flow. */ }
  }
}

function snapshotSourceType(snapshot: unknown): "OFFER" | "NEED" | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).sourceType;
  return value === "OFFER" || value === "NEED" ? value : null;
}

function resultCountBucket(count: number): "0" | "1-2" | "3-5" {
  return count === 0 ? "0" : count <= 2 ? "1-2" : "3-5";
}

function projectCrossOwnerRun(run: MatchingRunRecord, results: MatchingResultRecord[]): CrossOwnerOpportunityMatchingOutput {
  const sourceType = snapshotSourceType(run.criteriaSnapshot);
  if (!sourceType) throw new MatchingDomainError("MATCHING_RESULT_UNAVAILABLE");
  return { runId: run.id, results: results.slice(0, CROSS_OWNER_RESULT_LIMIT).map((result, index) => projectMatchingResultView({ result, sourceType, ordinal: index + 1 })) };
}

const unavailableSafety: CrossOwnerSafety = {
  async consume() { throw new Error("MATCHING_PROTECTION_UNAVAILABLE"); },
  async findReusable() { throw new Error("MATCHING_PROTECTION_UNAVAILABLE"); },
  async acquire() { throw new Error("MATCHING_PROTECTION_UNAVAILABLE"); },
  async release() { return undefined; },
};
