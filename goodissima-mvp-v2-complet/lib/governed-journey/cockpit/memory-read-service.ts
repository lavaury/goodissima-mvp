import { canViewMemoryObject, resolveMemoryPermissions } from "@/lib/governed-memory/persistence/permission-resolver";
import { ROLE_PERMISSIONS } from "@/lib/governed-memory/permissions";
import {
  buildGovernedMemoryCockpitView,
  type GovernedMemoryCockpitRawItem,
  type GovernedMemoryCockpitView,
} from "./memory-read-model.ts";
import {
  governedMemoryCockpitRepository,
  type GovernedMemoryCockpitRows,
} from "./memory-read-repository";

export class GovernedMemoryCockpitReadError extends Error {
  readonly code: "NOT_FOUND" | "GOVERNED_MEMORY_COCKPIT_READ_FAILED";
  constructor(code: "NOT_FOUND" | "GOVERNED_MEMORY_COCKPIT_READ_FAILED") {
    super(code);
    this.code = code;
    this.name = "GovernedMemoryCockpitReadError";
  }
}

function latestValidations(rows: GovernedMemoryCockpitRows["validations"]) {
  const byTarget = new Map<string, GovernedMemoryCockpitRows["validations"][number]>();
  for (const validation of rows) {
    const key = `${validation.targetType}:${validation.targetId}`;
    if (!byTarget.has(key)) byTarget.set(key, validation);
  }
  return byTarget;
}

function latestDisputes(rows: GovernedMemoryCockpitRows["disputes"]) {
  const byTarget = new Map<string, GovernedMemoryCockpitRows["disputes"][number]>();
  for (const dispute of rows) {
    const key = `${dispute.targetType}:${dispute.targetId}`;
    if (!byTarget.has(key)) byTarget.set(key, dispute);
  }
  return byTarget;
}

function traceExclusion(reason: string, count: number) {
  if (count > 0) console.error("GOVERNED_MEMORY_COCKPIT_PROJECTION_EXCLUDED", { reason, count });
}

export function createGovernedMemoryCockpitReadService(
  repository = governedMemoryCockpitRepository,
  permissionResolver = resolveMemoryPermissions,
) {
  return {
    async read(input: {
      formTemplateId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<GovernedMemoryCockpitView> {
      try {
        const root = await repository.resolveRoot(input);
        if (!root?.relationTemplate) throw new GovernedMemoryCockpitReadError("NOT_FOUND");
        const extension = root.relationTemplate.governedJourney;
        if (!extension) return buildGovernedMemoryCockpitView({ hasExtension: false, items: [] });
        const access = extension.relationCaseId
          ? await permissionResolver(extension.relationCaseId, input.requesterUserId, new Date())
          : { relationCaseId: "", userId: input.requesterUserId, permissions: new Set(ROLE_PERMISSIONS.RELATION_CASE_OWNER), sourceResourceIds: new Set<string>(), isOwner: true };
        if (!access) return buildGovernedMemoryCockpitView({ hasExtension: true, items: [] });
        const rows = await repository.listLinkedMemory({
          governedJourneyId: extension.id,
          relationCaseId: extension.relationCaseId,
        });
        const validations = latestValidations(rows.validations);
        const disputes = latestDisputes(rows.disputes);
        const mayViewMemory = access.permissions.has("VIEW_MEMORY");
        const items: GovernedMemoryCockpitRawItem[] = [];

        for (const source of rows.sources) {
          const restricted = source.status === "RESTRICTED" || Boolean(source.visibilityPolicyRef);
          if (!canViewMemoryObject(access, { type: "SOURCE", id: source.id, restricted })) continue;
          const unavailable = source.status === "DELETED" || source.status === "ANONYMIZED";
          items.push({
            id: source.id,
            type: "SOURCE",
            title: unavailable ? null : source.title,
            text: unavailable ? "Contenu de source indisponible" : source.excerpt?.trim() || source.title,
            kind: source.kind,
            status: source.status,
            recordedAt: source.recordedAt,
            sourceEventOccurredAt: source.governedJourneyEvent?.occurredAt ?? null,
            validation: validations.get(`SOURCE:${source.id}`) ?? null,
            dispute: disputes.get(`SOURCE:${source.id}`) ?? null,
            hasExplicitContext: Boolean(source.relationCaseId), directJourneyScope: true,
          });
        }

        if (mayViewMemory) {
          for (const fact of rows.facts) items.push({
            id: fact.id, type: "FACT", title: null, text: fact.statement, kind: null, status: fact.status,
            recordedAt: fact.recordedAt, sourceEventOccurredAt: null,
            validation: validations.get(`FACT:${fact.id}`) ?? null, hasExplicitContext: Boolean(fact.relationCaseId), directJourneyScope: fact.governedJourneyId === extension.id,
            dispute: disputes.get(`FACT:${fact.id}`) ?? null,
          });
          for (const decision of rows.decisions) items.push({
            id: decision.id, type: "DECISION", title: decision.title, text: decision.rationale, kind: null, status: decision.status,
            recordedAt: decision.recordedAt, sourceEventOccurredAt: null,
            validation: validations.get(`DECISION:${decision.id}`)
              ?? (decision.status === "VALIDATED" && decision.validatedAt ? { decision: "APPROVED" as const, validatedAt: decision.validatedAt } : null),
            dispute: disputes.get(`DECISION:${decision.id}`) ?? null, hasExplicitContext: Boolean(decision.relationCaseId), directJourneyScope: decision.governedJourneyId === extension.id,
          });
        }

        const linkedObjectCount = new Set(rows.relations.flatMap((relation) => [
          relation.sourceType !== "SOURCE" ? `${relation.sourceType}:${relation.sourceId}` : null,
          relation.targetType !== "SOURCE" ? `${relation.targetType}:${relation.targetId}` : null,
        ]).filter(Boolean)).size;
        traceExclusion("STRUCTURALLY_INVALID_LINK", linkedObjectCount - rows.facts.length - rows.decisions.length);
        return buildGovernedMemoryCockpitView({ hasExtension: true, items });
      } catch (error) {
        if (error instanceof GovernedMemoryCockpitReadError) throw error;
        throw new GovernedMemoryCockpitReadError("GOVERNED_MEMORY_COCKPIT_READ_FAILED");
      }
    },
  };
}

export const governedMemoryCockpitReadService = createGovernedMemoryCockpitReadService();
