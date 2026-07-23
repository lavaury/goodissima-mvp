import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  MatchingResultRecord,
  MatchingResultStatus,
  MatchingRunRecord,
  MatchingRunStatus,
} from "../matching-contracts.ts";

export type MatchingGLinkRecord = {
  id: string;
  ownerId: string;
  status: string;
};

export type MatchingRunListPage = {
  items: MatchingRunRecord[];
  nextCursor: string | null;
};

export type MatchingRunCreate = {
  ownerId: string;
  gLinkId: string;
  engineVersion: string;
  criteriaSnapshot: unknown;
  idempotencyKey: string | null;
};

export type MatchingRunUpdate = Partial<Pick<
  MatchingRunRecord,
  "status" | "isPaused" | "startedAt" | "completedAt" | "failedAt" | "pausedAt" | "closedAt" | "failureCode"
>>;

export type MatchingResultCreate = {
  targetGLinkId: string;
  explanation: unknown;
  internalRank: number | null;
};

export type MatchingResultUpdate = Partial<Pick<
  MatchingResultRecord,
  "status" | "selectedAt" | "dismissedAt" | "linkedAt" | "relationCaseId"
>>;

export type MatchingRepository = {
  transaction<T>(operation: (repository: MatchingRepository) => Promise<T>): Promise<T>;
  findGLinkForOwner(ownerId: string, gLinkId: string): Promise<MatchingGLinkRecord | null>;
  findActiveGLinksForOwner(ownerId: string, gLinkIds: string[]): Promise<MatchingGLinkRecord[]>;
  findRunForOwner(ownerId: string, runId: string): Promise<MatchingRunRecord | null>;
  findRunByIdempotencyKey(ownerId: string, idempotencyKey: string): Promise<MatchingRunRecord | null>;
  findRunWithResultsForOwner(ownerId: string, runId: string): Promise<{ run: MatchingRunRecord; results: MatchingResultRecord[] } | null>;
  listRunsForGLink(ownerId: string, gLinkId: string, limit: number, cursor?: string): Promise<MatchingRunListPage>;
  createRun(input: MatchingRunCreate): Promise<MatchingRunRecord>;
  updateRunConditionally(input: {
    ownerId: string;
    runId: string;
    expectedStatus: MatchingRunStatus;
    expectedPaused: boolean;
    data: MatchingRunUpdate;
  }): Promise<MatchingRunRecord | null>;
  findResultsForTargets(ownerId: string, runId: string, targetGLinkIds: string[]): Promise<MatchingResultRecord[]>;
  createMissingResults(ownerId: string, runId: string, results: MatchingResultCreate[]): Promise<void>;
  findResultForOwner(ownerId: string, runId: string, resultId: string): Promise<MatchingResultRecord | null>;
  updateResultConditionally(input: {
    ownerId: string;
    runId: string;
    resultId: string;
    expectedStatus: MatchingResultStatus;
    expectedRunStatus: MatchingRunStatus;
    data: MatchingResultUpdate;
  }): Promise<MatchingResultRecord | null>;
};

type MatchingPrismaClient = PrismaClient | Prisma.TransactionClient;

export class MatchingRunIdempotencyUniqueError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("MATCHING_RUN_IDEMPOTENCY_UNIQUE");
    this.name = "MatchingRunIdempotencyUniqueError";
    if (options && "cause" in options) this.cause = options.cause;
  }
}

export function isMatchingRunIdempotencyUniqueError(
  error: unknown,
): error is MatchingRunIdempotencyUniqueError {
  return error instanceof MatchingRunIdempotencyUniqueError;
}

export function isPrismaMatchingRunIdempotencyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false;
  const meta = "meta" in error && error.meta && typeof error.meta === "object"
    ? error.meta as Record<string, unknown>
    : null;
  const target = meta?.target ?? meta?.constraint;
  if (target === undefined) return true;
  const values = Array.isArray(target) ? target.map(String) : [String(target)];
  const normalized = values.join(",").toLowerCase();
  return normalized.includes("matchingrun_ownerid_idempotencykey_key")
    || (normalized.includes("ownerid") && normalized.includes("idempotencykey"));
}

function mapRun(row: {
  id: string; gLinkId: string; ownerId: string; status: MatchingRunStatus; isPaused: boolean;
  engineVersion: string; criteriaSnapshot: Prisma.JsonValue; startedAt: Date | null;
  completedAt: Date | null; failedAt: Date | null; pausedAt: Date | null; closedAt: Date | null;
  failureCode: string | null; idempotencyKey: string | null; createdAt: Date; updatedAt: Date;
}): MatchingRunRecord {
  return { ...row };
}

function mapResult(row: {
  id: string; runId: string; targetGLinkId: string; status: MatchingResultStatus;
  explanation: Prisma.JsonValue; internalRank: number | null; selectedAt: Date | null;
  dismissedAt: Date | null; linkedAt: Date | null; relationCaseId: string | null;
  createdAt: Date; updatedAt: Date;
}): MatchingResultRecord {
  return { ...row };
}

export class PrismaMatchingRepository implements MatchingRepository {
  private readonly client: MatchingPrismaClient;

  constructor(client: MatchingPrismaClient) {
    this.client = client;
  }

  async transaction<T>(operation: (repository: MatchingRepository) => Promise<T>): Promise<T> {
    if ("$transaction" in this.client) {
      return this.client.$transaction(
        (tx) => operation(new PrismaMatchingRepository(tx)),
        { isolationLevel: "Serializable" },
      );
    }
    return operation(this);
  }

  async findGLinkForOwner(ownerId: string, gLinkId: string) {
    return this.client.gLink.findFirst({
      where: { id: gLinkId, ownerId },
      select: { id: true, ownerId: true, status: true },
    });
  }

  async findActiveGLinksForOwner(ownerId: string, gLinkIds: string[]) {
    return this.client.gLink.findMany({
      where: { id: { in: gLinkIds }, ownerId, status: "ACTIVE" },
      select: { id: true, ownerId: true, status: true },
      orderBy: { id: "asc" },
    });
  }

  async findRunForOwner(ownerId: string, runId: string) {
    const row = await this.client.matchingRun.findFirst({ where: { id: runId, ownerId } });
    return row ? mapRun(row) : null;
  }

  async findRunByIdempotencyKey(ownerId: string, idempotencyKey: string) {
    const row = await this.client.matchingRun.findFirst({ where: { ownerId, idempotencyKey } });
    return row ? mapRun(row) : null;
  }

  async findRunWithResultsForOwner(ownerId: string, runId: string) {
    const row = await this.client.matchingRun.findFirst({
      where: { id: runId, ownerId },
      include: { results: { orderBy: [{ internalRank: "asc" }, { createdAt: "asc" }, { id: "asc" }] } },
    });
    return row ? { run: mapRun(row), results: row.results.map(mapResult) } : null;
  }

  async listRunsForGLink(ownerId: string, gLinkId: string, limit: number, cursor?: string) {
    const rows = await this.client.matchingRun.findMany({
      where: { ownerId, gLinkId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, limit).map(mapRun),
      nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null,
    };
  }

  async createRun(input: MatchingRunCreate) {
    try {
      const row = await this.client.matchingRun.create({
        data: { ...input, criteriaSnapshot: input.criteriaSnapshot as Prisma.InputJsonValue, status: "PREPARED", isPaused: false },
      });
      return mapRun(row);
    } catch (error) {
      if (isPrismaMatchingRunIdempotencyViolation(error)) {
        throw new MatchingRunIdempotencyUniqueError({ cause: error });
      }
      throw error;
    }
  }

  async updateRunConditionally(input: {
    ownerId: string; runId: string; expectedStatus: MatchingRunStatus; expectedPaused: boolean; data: MatchingRunUpdate;
  }) {
    const changed = await this.client.matchingRun.updateMany({
      where: { id: input.runId, ownerId: input.ownerId, status: input.expectedStatus, isPaused: input.expectedPaused },
      data: input.data,
    });
    return changed.count === 1 ? this.findRunForOwner(input.ownerId, input.runId) : null;
  }

  async findResultsForTargets(ownerId: string, runId: string, targetGLinkIds: string[]) {
    const rows = await this.client.matchingResult.findMany({
      where: { runId, targetGLinkId: { in: targetGLinkIds }, run: { ownerId } },
      orderBy: [{ internalRank: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(mapResult);
  }

  async createMissingResults(ownerId: string, runId: string, results: MatchingResultCreate[]) {
    if (results.length === 0) return;
    const ownedRun = await this.client.matchingRun.findFirst({
      where: { id: runId, ownerId, status: "RUNNING", isPaused: false },
      select: { id: true },
    });
    if (!ownedRun) return;
    await this.client.matchingResult.createMany({
      data: results.map((result) => ({
        ...result,
        explanation: result.explanation as Prisma.InputJsonValue,
        runId,
        status: "AVAILABLE" as const,
      })),
      skipDuplicates: true,
    });
  }

  async findResultForOwner(ownerId: string, runId: string, resultId: string) {
    const row = await this.client.matchingResult.findFirst({
      where: { id: resultId, runId, run: { ownerId } },
    });
    return row ? mapResult(row) : null;
  }

  async updateResultConditionally(input: {
    ownerId: string; runId: string; resultId: string; expectedStatus: MatchingResultStatus;
    expectedRunStatus: MatchingRunStatus; data: MatchingResultUpdate;
  }) {
    const changed = await this.client.matchingResult.updateMany({
      where: {
        id: input.resultId,
        runId: input.runId,
        status: input.expectedStatus,
        run: { ownerId: input.ownerId, status: input.expectedRunStatus, isPaused: false },
      },
      data: input.data,
    });
    return changed.count === 1
      ? this.findResultForOwner(input.ownerId, input.runId, input.resultId)
      : null;
  }
}

export function createPrismaMatchingRepository(client: PrismaClient): MatchingRepository {
  return new PrismaMatchingRepository(client);
}
