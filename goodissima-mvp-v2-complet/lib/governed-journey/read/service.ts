import { governedJourneyReadRepository, type GovernedJourneyReadCursor, type GovernedJourneyReadRepository, type GovernedJourneyReadRow } from "./repository";
import type { GovernedJourneyDetail, GovernedJourneyList, GovernedJourneySummary } from "./types";

export class GovernedJourneyReadError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "NOT_FOUND") {
    super(code);
    this.name = "GovernedJourneyReadError";
  }
}

function requiredId(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new GovernedJourneyReadError("INVALID_INPUT");
  return normalized;
}

function encodeCursor(cursor: GovernedJourneyReadCursor) {
  return Buffer.from(JSON.stringify({ updatedAt: cursor.updatedAt.toISOString(), id: cursor.id }), "utf8").toString("base64url");
}

function decodeCursor(value?: string): GovernedJourneyReadCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { updatedAt?: unknown; id?: unknown };
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string" || !parsed.id) throw new Error();
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) throw new Error();
    return { updatedAt, id: parsed.id };
  } catch {
    throw new GovernedJourneyReadError("INVALID_INPUT");
  }
}

function summary(row: GovernedJourneyReadRow): GovernedJourneySummary {
  return {
    id: row.id, title: row.title, status: row.status,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null, suspendedAt: row.suspendedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null,
    // Deferred: no canonical, reusable visibility predicate exists for memory sources yet.
    visibleMemorySourceCount: null,
  };
}

export function createGovernedJourneyReadService(repository: GovernedJourneyReadRepository = governedJourneyReadRepository) {
  return {
    async list(input: { relationCaseId: string; requesterUserId: string; limit?: number; cursor?: string }): Promise<GovernedJourneyList> {
      const relationCaseId = requiredId(input.relationCaseId);
      const requesterUserId = requiredId(input.requesterUserId);
      const limit = input.limit ?? 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new GovernedJourneyReadError("INVALID_INPUT");
      const result = await repository.listOwned({ relationCaseId, requesterUserId, limit, cursor: decodeCursor(input.cursor) });
      if (!result.authorized) throw new GovernedJourneyReadError("NOT_FOUND");
      const hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const last = rows.at(-1);
      return { items: rows.map(summary), nextCursor: hasMore && last ? encodeCursor({ updatedAt: last.updatedAt, id: last.id }) : null };
    },

    async detail(input: { relationCaseId: string; journeyId: string; requesterUserId: string }): Promise<GovernedJourneyDetail> {
      const result = await repository.detailOwned({
        relationCaseId: requiredId(input.relationCaseId), journeyId: requiredId(input.journeyId), requesterUserId: requiredId(input.requesterUserId),
      });
      if (!result) throw new GovernedJourneyReadError("NOT_FOUND");
      return {
        ...summary(result.journey),
        events: result.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
      };
    },
  };
}

export const governedJourneyReadService = createGovernedJourneyReadService();
