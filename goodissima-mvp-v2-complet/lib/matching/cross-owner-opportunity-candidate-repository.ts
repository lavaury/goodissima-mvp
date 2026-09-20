import type { PrismaClient } from "@prisma/client";
import type { OpportunityType } from "../opportunities/contracts.ts";
import {
  buildMatchableOpportunityProjection,
  structuredOpportunityMatchingConsent,
  type MatchableOpportunityProjectionV1,
} from "../opportunities/matching/matchable-projection.ts";

export const CROSS_OWNER_CANDIDATE_LIMIT_MAX = 100;
const CROSS_OWNER_CANDIDATE_OVERFETCH_FACTOR = 4;

/** Internal server-only contract. It must never be used as an HTTP response type. */
export type MatchCandidateV1 = {
  internalTargetRef: string;
  internalOwnerRef: string;
  projection: MatchableOpportunityProjectionV1;
};

export type MatchableOpportunityCandidateRepository = {
  listEligibleCandidates(input: {
    sourceId: string;
    sourceOwnerId: string;
    complementaryType: OpportunityType;
    limit: number;
  }): Promise<MatchCandidateV1[]>;
};

type CandidatePrismaClient = Pick<PrismaClient, "gLink">;

export class PrismaMatchableOpportunityCandidateRepository implements MatchableOpportunityCandidateRepository {
  private readonly client: CandidatePrismaClient;

  constructor(client: CandidatePrismaClient) {
    this.client = client;
  }

  async listEligibleCandidates(input: {
    sourceId: string;
    sourceOwnerId: string;
    complementaryType: OpportunityType;
    limit: number;
  }): Promise<MatchCandidateV1[]> {
    assertCandidateLimit(input.limit);

    const rows = await this.client.gLink.findMany({
      where: {
        id: { not: input.sourceId },
        ownerId: { not: input.sourceOwnerId },
        status: "ACTIVE",
        AND: [
          { rules: { path: ["opportunity", "type"], equals: input.complementaryType } },
          { rules: { path: ["opportunity", "matchingEnabled"], equals: true } },
        ],
      },
      orderBy: { id: "asc" },
      take: Math.min(CROSS_OWNER_CANDIDATE_LIMIT_MAX * CROSS_OWNER_CANDIDATE_OVERFETCH_FACTOR, input.limit * CROSS_OWNER_CANDIDATE_OVERFETCH_FACTOR),
      select: { id: true, ownerId: true, status: true, rules: true },
    });

    const candidates: MatchCandidateV1[] = [];
    for (const row of rows) {
      if (candidates.length >= input.limit) break;
      if (row.id === input.sourceId || row.ownerId === input.sourceOwnerId || row.status !== "ACTIVE") continue;
      if (structuredOpportunityMatchingConsent(row.rules) !== "ENABLED") continue;
      const projection = buildMatchableOpportunityProjection({ rules: row.rules });
      if (!projection || projection.opportunityType !== input.complementaryType) continue;
      candidates.push({ internalTargetRef: row.id, internalOwnerRef: row.ownerId, projection });
    }
    return candidates;
  }
}

export function createMatchableOpportunityCandidateRepository(client: PrismaClient): MatchableOpportunityCandidateRepository {
  return new PrismaMatchableOpportunityCandidateRepository(client);
}

function assertCandidateLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > CROSS_OWNER_CANDIDATE_LIMIT_MAX) {
    throw new RangeError(`limit must be an integer between 1 and ${CROSS_OWNER_CANDIDATE_LIMIT_MAX}`);
  }
}
