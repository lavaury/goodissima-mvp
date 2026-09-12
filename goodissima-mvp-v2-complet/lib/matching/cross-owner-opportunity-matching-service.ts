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

const CROSS_OWNER_CANDIDATE_LIMIT = 80;
const CROSS_OWNER_RESULT_LIMIT = 50;

export type MatchableOpportunitySourceV1 = {
  internalSourceRef: string;
  internalOwnerRef: string;
  projection: MatchableOpportunityProjectionV1;
};

export type MatchableOpportunitySourceRepository = {
  findEligibleSourceForOwner(ownerId: string, sourceId: string): Promise<MatchableOpportunitySourceV1 | null>;
};

type CrossOwnerLifecycle = {
  prepareMatchingRun(input: { ownerId: string; gLinkId: string; engineVersion: string; criteriaSnapshot: unknown; idempotencyKey?: string }): Promise<MatchingRunRecord>;
  startMatchingRun(input: { ownerId: string; runId: string }): Promise<MatchingRunRecord>;
  createCrossOwnerMatchingResults(input: {
    ownerId: string; runId: string; expectedSourceProjection: MatchableOpportunityProjectionV1;
    results: Array<{ internalTargetRef: string; expectedProjection: MatchableOpportunityProjectionV1; explanation: unknown; internalRank?: number }>;
  }): Promise<MatchingResultRecord[]>;
  markMatchingResultsAvailable(input: { ownerId: string; runId: string }): Promise<MatchingRunRecord>;
  failMatchingRun(input: { ownerId: string; runId: string; failureCode: string }): Promise<MatchingRunRecord>;
};

export type CrossOwnerOpportunityMatchingOutput = {
  runId: string;
  persistedCount: number;
  results: MatchingResultViewV1[];
};

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

  constructor(
    sources: MatchableOpportunitySourceRepository,
    candidates: MatchableOpportunityCandidateRepository,
    lifecycle: CrossOwnerLifecycle,
  ) {
    this.sources = sources;
    this.candidates = candidates;
    this.lifecycle = lifecycle;
  }

  async execute(input: { ownerId: string; sourceId: string; idempotencyKey?: string }): Promise<CrossOwnerOpportunityMatchingOutput> {
    const source = await this.sources.findEligibleSourceForOwner(input.ownerId, input.sourceId);
    if (!source || source.internalOwnerRef !== input.ownerId) throw new MatchingDomainError("MATCHING_SOURCE_NOT_FOUND");
    const snapshot = {
      engineVersion: OPPORTUNITY_STRUCTURED_ENGINE_VERSION,
      scope: "CROSS_OWNER_V1",
      matchingConsent: "EXPLICIT",
      projectionVersion: source.projection.schemaVersion,
      sourceType: source.projection.opportunityType,
      criteria: source.projection,
      comparatorPolicyVersion: OPPORTUNITY_COMPARATOR_POLICY_VERSION,
    };
    const run = await this.lifecycle.prepareMatchingRun({ ownerId: input.ownerId, gLinkId: source.internalSourceRef, engineVersion: OPPORTUNITY_STRUCTURED_ENGINE_VERSION, criteriaSnapshot: snapshot, idempotencyKey: input.idempotencyKey });
    try {
      await this.lifecycle.startMatchingRun({ ownerId: input.ownerId, runId: run.id });
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
      return {
        runId: run.id,
        persistedCount: persisted.length,
        results: persisted.map((result, index) => projectMatchingResultView({ result, sourceType: source.projection.opportunityType, ordinal: index + 1 })),
      };
    } catch {
      await this.lifecycle.failMatchingRun({ ownerId: input.ownerId, runId: run.id, failureCode: "CROSS_OWNER_MATCHING_EXECUTION_FAILED" }).catch(() => undefined);
      throw new MatchingDomainError("MATCHING_EXECUTION_FAILED");
    }
  }
}
