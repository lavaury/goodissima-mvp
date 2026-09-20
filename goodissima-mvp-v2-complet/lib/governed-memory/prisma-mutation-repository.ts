import "server-only";
import { prisma } from "@/lib/prisma";
import type { GovernedMemoryMutationRepository, MemoryMutationInput, MemoryMutationResult } from "./mutation-service";

const rolePermissions: Record<string, string[]> = {
  MEMORY_STEWARD: ["PROPOSE_FACT", "ESTABLISH_FACT", "DISPUTE_FACT", "RECORD_DECISION", "VALIDATE_DECISION", "REGISTER_SOURCE"],
  MEMORY_DELEGATE: ["PROPOSE_FACT", "DISPUTE_FACT", "RECORD_DECISION", "REGISTER_SOURCE"],
};
const requiredPermission: Record<MemoryMutationInput["operation"], string> = {
  PROPOSE_FACT: "PROPOSE_FACT", RECORD_DECISION: "RECORD_DECISION", REGISTER_SOURCE: "REGISTER_SOURCE",
  ESTABLISH_FACT: "ESTABLISH_FACT", DISPUTE_FACT: "DISPUTE_FACT", VALIDATE_DECISION: "VALIDATE_DECISION",
};
const eventType = { PROPOSE_FACT: "FACT_PROPOSED", RECORD_DECISION: "DECISION_RECORDED", REGISTER_SOURCE: "SOURCE_REGISTERED", ESTABLISH_FACT: "FACT_ESTABLISHED", DISPUTE_FACT: "FACT_DISPUTED", VALIDATE_DECISION: "DECISION_VALIDATED" } as const;
const targetType = { PROPOSE_FACT: "FACT", RECORD_DECISION: "DECISION", REGISTER_SOURCE: "SOURCE", ESTABLISH_FACT: "FACT", DISPUTE_FACT: "FACT", VALIDATE_DECISION: "DECISION" } as const;

function clean(value: string | undefined, error: string, max: number) { const result = value?.trim(); if (!result || result.length > max) throw new Error(error); return result; }

export class PrismaGovernedMemoryMutationRepository implements GovernedMemoryMutationRepository {
  async execute(userId: string, input: MemoryMutationInput, fingerprint: string, ids: { request: string; object: string; event: string; auxiliary: string }, now: Date): Promise<MemoryMutationResult> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${input.operation}:${input.requestKey}`}, 0))`;
      const creation = input.operation === "PROPOSE_FACT" || input.operation === "RECORD_DECISION" || input.operation === "REGISTER_SOURCE";
      const previous: any = creation
        ? await tx.governedMemoryCreationRequest.findUnique({ where: { requesterUserId_requestKey: { requesterUserId: userId, requestKey: input.requestKey } } })
        : await tx.governedMemoryTransitionRequest.findUnique({ where: { requesterUserId_requestKey: { requesterUserId: userId, requestKey: input.requestKey } } });
      if (previous) {
        if (previous.requestFingerprint !== fingerprint) throw new Error("MEMORY_IDEMPOTENCY_CONFLICT");
        const objectId = previous.factId ?? previous.decisionId ?? previous.sourceId;
        if (!previous.completedAt || !objectId) throw new Error("MEMORY_REQUEST_IN_PROGRESS");
        return { objectType: targetType[input.operation], objectId, replayed: true };
      }

      const journey = await tx.governedJourney.findUnique({ where: { id: input.journeyId }, select: { id: true, relationTemplateId: true, relationCaseContexts: { where: input.relationCaseId ? { relationCaseId: input.relationCaseId } : undefined, select: { relationCaseId: true } }, memoryRoleAssignments: { where: { userId, revokedAt: null }, select: { role: true } } } });
      if (!journey || (input.relationCaseId && journey.relationCaseContexts.length !== 1)) throw new Error("MEMORY_NOT_FOUND");
      const permission = requiredPermission[input.operation];
      const grant = input.relationCaseId ? await tx.governedMemoryAccessGrant.findFirst({ where: { relationCaseId: input.relationCaseId, subjectType: "USER", subjectUserId: userId, permission: permission as any, revokedAt: null, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }, select: { id: true } }) : null;
      const role = journey.memoryRoleAssignments.find((item) => rolePermissions[item.role]?.includes(permission));
      if (!grant && !role) throw new Error("MEMORY_NOT_FOUND");

      const base = { relationTemplateId: journey.relationTemplateId, governedJourneyId: journey.id, relationCaseId: input.relationCaseId ?? null };
      if (creation) await tx.governedMemoryCreationRequest.create({ data: { id: ids.request, requesterUserId: userId, requestKey: input.requestKey, requestFingerprint: fingerprint, category: targetType[input.operation] as any, ...base } });
      else await tx.governedMemoryTransitionRequest.create({ data: { id: ids.request, requesterUserId: userId, requestKey: input.requestKey, requestFingerprint: fingerprint, transitionType: input.operation as any, factId: targetType[input.operation] === "FACT" ? input.targetId : null, decisionId: targetType[input.operation] === "DECISION" ? input.targetId : null, ...base } });

      let objectId = ids.object;
      if (input.operation === "PROPOSE_FACT") await tx.governedMemoryFact.create({ data: { id: objectId, statement: clean(input.statement, "MEMORY_INVALID_STATEMENT", 4000), status: "PROPOSED", evidenceLevel: "DECLARED", authorUserId: userId, recordedAt: now, effectiveFrom: now, updatedAt: now, ...base } });
      if (input.operation === "RECORD_DECISION") await tx.governedMemoryDecision.create({ data: { id: objectId, title: clean(input.title, "MEMORY_INVALID_TITLE", 300), rationale: clean(input.rationale, "MEMORY_INVALID_RATIONALE", 4000), status: "DRAFT", decidedByUserId: userId, decidedAt: now, recordedAt: now, effectiveFrom: now, updatedAt: now, ...base } });
      if (input.operation === "REGISTER_SOURCE") await tx.governedMemorySource.create({ data: { id: objectId, kind: input.sourceKind ?? "HUMAN_DECLARATION", status: "ACTIVE", sourceObjectType: clean(input.sourceObjectType, "MEMORY_INVALID_SOURCE", 200), sourceObjectId: clean(input.sourceObjectId, "MEMORY_INVALID_SOURCE", 500), title: clean(input.title, "MEMORY_INVALID_TITLE", 300), recordedAt: now, updatedAt: now, ...base } });
      let validationId: string | null = null; let disputeId: string | null = null;
      if (input.operation === "ESTABLISH_FACT") { const fact = await tx.governedMemoryFact.findFirst({ where: { id: input.targetId, ...base } }); if (!fact || fact.status !== "PROPOSED" || !role) throw new Error("MEMORY_NOT_FOUND"); objectId = fact.id; validationId = ids.auxiliary; await tx.governedMemoryFact.update({ where: { id: fact.id }, data: { status: "ESTABLISHED", establishedByUserId: userId, establishedAt: now, updatedAt: now } }); await tx.governedMemoryValidation.create({ data: { id: validationId, targetType: "FACT", targetId: fact.id, validatorUserId: userId, validatorRole: role.role, decision: "APPROVED", validatedAt: now, ...base } }); }
      if (input.operation === "VALIDATE_DECISION") { const decision = await tx.governedMemoryDecision.findFirst({ where: { id: input.targetId, ...base } }); if (!decision || decision.status !== "DRAFT" || !role) throw new Error("MEMORY_NOT_FOUND"); objectId = decision.id; validationId = ids.auxiliary; await tx.governedMemoryDecision.update({ where: { id: decision.id }, data: { status: "VALIDATED", validatedByUserId: userId, validatedAt: now, updatedAt: now } }); await tx.governedMemoryValidation.create({ data: { id: validationId, targetType: "DECISION", targetId: decision.id, validatorUserId: userId, validatorRole: role.role, decision: "APPROVED", validatedAt: now, ...base } }); }
      if (input.operation === "DISPUTE_FACT") { const fact = await tx.governedMemoryFact.findFirst({ where: { id: input.targetId, status: "ESTABLISHED", ...base } }); if (!fact) throw new Error("MEMORY_NOT_FOUND"); objectId = fact.id; disputeId = ids.auxiliary; await tx.governedMemoryFact.update({ where: { id: fact.id }, data: { status: "DISPUTED", evidenceLevel: "CONTESTED", updatedAt: now } }); await tx.governedMemoryDispute.create({ data: { id: disputeId, targetType: "FACT", targetId: fact.id, raisedByUserId: userId, reason: clean(input.reason, "MEMORY_INVALID_REASON", 4000), status: "OPEN", raisedAt: now, updatedAt: now, ...base } }); }
      await tx.governedMemoryEvent.create({ data: { id: ids.event, type: eventType[input.operation], actorType: "HUMAN", actorUserId: userId, objectType: targetType[input.operation], objectId, occurredAt: now, recordedAt: now, summary: `${eventType[input.operation]} by authorized human`, ...base } });
      if (creation) await tx.governedMemoryCreationRequest.update({ where: { id: ids.request }, data: { completedAt: now, factId: targetType[input.operation] === "FACT" ? objectId : null, decisionId: targetType[input.operation] === "DECISION" ? objectId : null, sourceId: targetType[input.operation] === "SOURCE" ? objectId : null } });
      else await tx.governedMemoryTransitionRequest.update({ where: { id: ids.request }, data: { completedAt: now, validationId, disputeId, eventId: ids.event } });
      return { objectType: targetType[input.operation], objectId, replayed: false };
    });
  }
}
