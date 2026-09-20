import type { JourneyMemoryCapabilities, JourneyMemoryProjection, MemoryActorOrigin, MemoryProvenance } from "./contracts";
import type { GovernedMemoryReadRepository, JourneyMemoryAccessRecord, MemoryPermission } from "./repository";

const rolePermissions: Record<string, MemoryPermission[]> = {
  MEMORY_STEWARD: ["VIEW_MEMORY", "VIEW_SOURCES", "PROPOSE_FACT", "ESTABLISH_FACT", "DISPUTE_FACT", "RECORD_DECISION", "VALIDATE_DECISION", "REGISTER_SOURCE"],
  MEMORY_DELEGATE: ["VIEW_MEMORY", "VIEW_SOURCES", "PROPOSE_FACT", "DISPUTE_FACT", "RECORD_DECISION", "REGISTER_SOURCE"],
};

function capabilities(access: JourneyMemoryAccessRecord): JourneyMemoryCapabilities {
  const effective = new Set<MemoryPermission>(access.permissions);
  for (const role of access.roles) for (const permission of rolePermissions[role] ?? []) effective.add(permission);
  return {
    canView: effective.has("VIEW_MEMORY"), canViewSources: effective.has("VIEW_SOURCES"),
    canPropose: effective.has("PROPOSE_FACT"), canEstablishFact: effective.has("ESTABLISH_FACT"),
    canDispute: effective.has("DISPUTE_FACT"), canRecordDecision: effective.has("RECORD_DECISION"),
    canValidateDecision: effective.has("VALIDATE_DECISION"), canRegisterSource: effective.has("REGISTER_SOURCE"),
  };
}

const sourceTypeLabels: Record<string, string> = {
  DOCUMENT: "Document", DOCUMENT_VERSION: "Version de document", FORM_SUBMISSION: "Réponse à un formulaire",
  MESSAGE_EXCERPT: "Extrait de message", SYSTEM_EVENT: "Événement système", HUMAN_DECLARATION: "Déclaration humaine",
  VALIDATED_SYNTHESIS: "Synthèse validée", EXTERNAL_IMPORT: "Import externe",
};

function actorFor(events: any[], objectType: string, objectId: string): MemoryActorOrigin | null {
  return events.find((event) => event.objectType === objectType && event.objectId === objectId)?.actorType ?? null;
}

function factState(status: string): "proposed" | "established" | "contested" | "superseded" {
  return status === "ESTABLISHED" ? "established" : status === "DISPUTED" ? "contested" : status === "SUPERSEDED" ? "superseded" : "proposed";
}

function decisionState(status: string): "draft" | "validated" | "superseded" | "cancelled" {
  return status === "VALIDATED" ? "validated" : status === "SUPERSEDED" ? "superseded" : status === "CANCELLED" ? "cancelled" : "draft";
}

function evidenceLevel(value: string): "declared" | "supported" | "corroborated" | "contested" {
  return value === "SUPPORTED" ? "supported" : value === "CORROBORATED" ? "corroborated" : value === "CONTESTED" ? "contested" : "declared";
}

function provenance(records: any, events: any[], relations: any[], objectType: string, includeSources: boolean): MemoryProvenance {
  const sourceHandles = includeSources ? relations.filter((relation) => relation.targetType === objectType && relation.targetId === records.id && relation.sourceType === "SOURCE").map((relation) => relation.sourceId) : [];
  return { actorOrigin: actorFor(events, objectType, records.id), recordedAt: records.recordedAt.toISOString(), sourceHandles };
}

const memoryEventActions: Record<string, string> = {
  FACT_PROPOSED: "a proposé un fait.", FACT_ESTABLISHED: "a confirmé un fait.",
  FACT_DISPUTED: "a contesté un fait.", DISPUTE_OPENED: "a contesté un fait.",
  DECISION_RECORDED: "a préparé une décision.", DECISION_VALIDATED: "a confirmé une décision.",
  SOURCE_REGISTERED: "a ajouté une source.",
};

function compactLabel(value: string | undefined) {
  if (!value) return null;
  return value.length > 180 ? `${value.slice(0, 177)}…` : value;
}

export class GovernedMemoryReadService {
  private readonly repository: GovernedMemoryReadRepository;
  private readonly now: () => Date;

  constructor(repository: GovernedMemoryReadRepository, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  /** Null deliberately covers absent and unauthorized journeys to prevent existence disclosure. */
  async readJourneyGovernedMemory(journeyId: string, userId: string): Promise<JourneyMemoryProjection | null> {
    if (!journeyId.trim() || !userId.trim()) return null;
    const access = await this.repository.findJourneyAccess(journeyId, userId, this.now());
    if (!access) return null;
    const allowed = capabilities(access);
    if (!allowed.canView) return null;
    const records = await this.repository.readJourneyMemory(access.journeyId, access.relationCaseIds, access.wholeJourney, allowed.canViewSources);
    const openDisputes = new Set(records.disputes.filter((item) => item.status === "OPEN").map((item) => `${item.targetType}:${item.targetId}`));
    const facts = records.facts.map((fact) => {
      const contested = fact.status === "DISPUTED" || openDisputes.has(`FACT:${fact.id}`);
      const superseded = fact.status === "SUPERSEDED" || Boolean(fact.supersededByFactId);
      return { handle: fact.id, statement: fact.statement, state: superseded ? "superseded" as const : contested ? "contested" as const : factState(fact.status), evidenceLevel: evidenceLevel(fact.evidenceLevel), provenance: provenance(fact, records.events, records.relations, "FACT", allowed.canViewSources), contested, superseded, effectiveFrom: fact.effectiveFrom.toISOString(), effectiveUntil: fact.effectiveUntil?.toISOString() ?? null, establishedAt: fact.establishedAt?.toISOString() ?? null };
    });
    const decisions = records.decisions.map((decision) => ({ handle: decision.id, title: decision.title, rationale: decision.rationale, state: decisionState(decision.status), provenance: provenance(decision, records.events, records.relations, "DECISION", allowed.canViewSources), decidedAt: decision.decidedAt.toISOString(), validatedAt: decision.validatedAt?.toISOString() ?? null }));
    const sources = allowed.canViewSources ? records.sources.map((source) => ({ handle: source.id, title: source.title, type: sourceTypeLabels[source.kind] ?? "Source", state: source.status.toLowerCase(), provenance: { actorOrigin: actorFor(records.events, "SOURCE", source.id), recordedAt: source.recordedAt.toISOString() }, available: source.status === "ACTIVE" && !source.unavailableReason })) : [];
    const pending = [
      ...records.facts.filter((fact) => fact.status === "PROPOSED").map((fact) => ({ kind: "fact" as const, handle: fact.id, label: fact.statement, recordedAt: fact.recordedAt.toISOString() })),
      ...records.decisions.filter((decision) => decision.status === "DRAFT").map((decision) => ({ kind: "decision" as const, handle: decision.id, label: decision.title, recordedAt: decision.recordedAt.toISOString() })),
    ];
    const factLabels = new Map(records.facts.map((fact) => [fact.id, fact.statement]));
    const decisionLabels = new Map(records.decisions.map((decision) => [decision.id, decision.title]));
    const sourceLabels = new Map((allowed.canViewSources ? records.sources : []).map((source) => [source.id, source.title]));
    const history = records.events.map((event) => {
      const hiddenSource = event.objectType === "SOURCE" && !allowed.canViewSources;
      const action = hiddenSource ? "a ajouté un élément à la mémoire." : memoryEventActions[event.type] ?? "a enregistré une évolution de la mémoire.";
      const objectLabel = hiddenSource ? null : compactLabel(event.objectType === "FACT" ? factLabels.get(event.objectId) : event.objectType === "DECISION" ? decisionLabels.get(event.objectId) : event.objectType === "SOURCE" ? sourceLabels.get(event.objectId) : undefined);
      return { handle: event.id, actorLabel: event.actorType === "SYSTEM" ? "Goodissima" as const : "Une personne" as const, action, objectLabel, occurredAt: event.occurredAt.toISOString() };
    }).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.handle.localeCompare(left.handle));
    return { facts, decisions, sources, pending, history, capabilities: allowed };
  }
}

// SYSTEM means only a system-originated record. It must not be presented as AI without a future, explicit provenance contract.
