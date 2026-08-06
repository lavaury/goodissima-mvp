import type { GovernedMemoryCreationCategory, Prisma, PrismaClient } from "@prisma/client";

type Database = PrismaClient | Prisma.TransactionClient;
const select = {
  requesterUserId: true, requestKey: true, requestFingerprint: true, category: true,
  relationTemplateId: true, governedJourneyId: true, relationCaseId: true,
  factId: true, decisionId: true, sourceId: true, completedAt: true,
  governedJourney: { select: { id: true, relationTemplateId: true } },
  relationCase: { select: { id: true, templateId: true } },
  fact: { select: { id: true, relationTemplateId: true, governedJourneyId: true, relationCaseId: true } },
  decision: { select: { id: true, relationTemplateId: true, governedJourneyId: true, relationCaseId: true } },
  source: { select: { id: true, relationTemplateId: true, governedJourneyId: true, relationCaseId: true } },
} satisfies Prisma.GovernedMemoryCreationRequestSelect;

export type CompletedMemoryCreationRequest = Prisma.GovernedMemoryCreationRequestGetPayload<{ select: typeof select }>;

export function findCompletedMemoryCreationRequest(database: Database, input: { requesterUserId: string; requestKey: string }) {
  return database.governedMemoryCreationRequest.findUnique({
    where: { requesterUserId_requestKey: { requesterUserId: input.requesterUserId, requestKey: input.requestKey } }, select,
  });
}

export function createMemoryCreationReservation(input: { tx: Prisma.TransactionClient; requesterUserId: string; requestKey: string; requestFingerprint: string; category: GovernedMemoryCreationCategory; relationTemplateId: string; governedJourneyId: string; relationCaseId: string | null }) {
  return input.tx.governedMemoryCreationRequest.create({ data: { requesterUserId: input.requesterUserId, requestKey: input.requestKey,
    requestFingerprint: input.requestFingerprint, category: input.category, relationTemplateId: input.relationTemplateId,
    governedJourneyId: input.governedJourneyId, relationCaseId: input.relationCaseId }, select: { id: true } });
}

export function completeMemoryCreation(input: { tx: Prisma.TransactionClient; requesterUserId: string; requestKey: string; requestFingerprint: string; category: GovernedMemoryCreationCategory; relationTemplateId: string; governedJourneyId: string; relationCaseId: string | null; result: { factId: string } | { decisionId: string } | { sourceId: string }; completedAt: Date }) {
  return input.tx.governedMemoryCreationRequest.updateMany({ where: { requesterUserId: input.requesterUserId, requestKey: input.requestKey,
    requestFingerprint: input.requestFingerprint, category: input.category, relationTemplateId: input.relationTemplateId,
    governedJourneyId: input.governedJourneyId, relationCaseId: input.relationCaseId, completedAt: null,
    factId: null, decisionId: null, sourceId: null }, data: { ...input.result, completedAt: input.completedAt } });
}

function target(error: unknown) { if (!error || typeof error !== "object" || !("meta" in error)) return ""; const meta = error.meta; if (!meta || typeof meta !== "object" || !("target" in meta)) return ""; return Array.isArray(meta.target) ? meta.target.join(",") : String(meta.target ?? ""); }
export function isMemoryRequestKeyConflict(error: unknown) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false; const value = target(error); return value.includes("GovernedMemoryCreationRequest_requesterUserId_requestKey_key") || (value.includes("requesterUserId") && value.includes("requestKey")); }
export function isMemoryResultConflict(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002" && !isMemoryRequestKeyConflict(error)); }
export function isMemorySerializationConflict(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034"); }
