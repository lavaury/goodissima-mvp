import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export type CreatedJourneyIdentity = {
  id: string;
  relationTemplateId: string;
  formTemplateId: string;
  authorityUserId: string;
  relationCaseId: string | null;
};

export function journeyCreationTemplateKey(authorityUserId: string, requestKey: string): string {
  return `PARCOURS_${createHash("sha256").update(`${authorityUserId}:${requestKey}`).digest("hex").slice(0, 48).toUpperCase()}`;
}

type CreatedJourneyReadback = {
  id: string;
  relationTemplateId: string;
  formTemplateId: string | null;
  authorityUserId: string;
  relationCaseId: string | null;
  status: string;
  events: Array<{
    type: string;
    sequence: number;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string;
    authorityUserId: string;
    relationCaseId: string | null;
  }>;
};

export function createdJourneyReadbackMatches(
  journey: CreatedJourneyReadback | null,
  expected: CreatedJourneyIdentity,
): boolean {
  if (!journey || journey.id !== expected.id
    || journey.relationTemplateId !== expected.relationTemplateId
    || journey.formTemplateId !== expected.formTemplateId
    || journey.authorityUserId !== expected.authorityUserId
    || journey.relationCaseId !== expected.relationCaseId
    || journey.status !== "DRAFT" || journey.events.length !== 1) return false;
  const [created] = journey.events;
  return created.type === "CREATED" && created.sequence === 1
    && created.fromStatus === null && created.toStatus === "DRAFT"
    && created.actorUserId === expected.authorityUserId
    && created.authorityUserId === expected.authorityUserId
    && created.relationCaseId === expected.relationCaseId;
}

export async function createJourneyRootAndCreated(
  tx: Prisma.TransactionClient,
  input: Omit<CreatedJourneyIdentity, "id"> & {
    id?: string;
    createdFromTemplateVersionId: string;
    title: string;
    reason?: string;
  },
): Promise<CreatedJourneyIdentity> {
  const occurredAt = new Date();
  const journey = await tx.governedJourney.create({ data: {
    id: input.id ?? randomUUID(),
    relationTemplateId: input.relationTemplateId,
    formTemplateId: input.formTemplateId,
    relationCaseId: input.relationCaseId,
    createdFromTemplateVersionId: input.createdFromTemplateVersionId,
    title: input.title,
    status: "DRAFT",
    authorityUserId: input.authorityUserId,
    updatedAt: occurredAt,
  } });
  await tx.governedJourneyEvent.create({ data: {
    id: randomUUID(),
    governedJourneyId: journey.id,
    relationCaseId: journey.relationCaseId,
    authorityUserId: journey.authorityUserId,
    actorUserId: input.authorityUserId,
    type: "CREATED",
    sequence: 1,
    fromStatus: null,
    toStatus: "DRAFT",
    occurredAt,
    reason: input.reason ?? null,
  } });

  // LAST business DB operation in the transaction. Prisma 5.22 may resolve a
  // deferred COMMIT failure after PostgreSQL has rolled back; force M2 now.
  await tx.$executeRawUnsafe('SET CONSTRAINTS "GovernedJourney_created_at_commit" IMMEDIATE');

  return {
    id: journey.id,
    relationTemplateId: journey.relationTemplateId,
    formTemplateId: input.formTemplateId,
    authorityUserId: journey.authorityUserId,
    relationCaseId: journey.relationCaseId,
  };
}
