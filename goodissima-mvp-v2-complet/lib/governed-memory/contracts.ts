export type MemoryActorOrigin = "HUMAN" | "SYSTEM";

export type JourneyMemoryCapabilities = {
  canView: boolean;
  canViewSources: boolean;
  canPropose: boolean;
  canEstablishFact: boolean;
  canDispute: boolean;
  canRecordDecision: boolean;
  canValidateDecision: boolean;
  canRegisterSource: boolean;
};

export type MemoryProvenance = {
  actorOrigin: MemoryActorOrigin | null;
  recordedAt: string;
  sourceHandles: string[];
};

export type JourneyMemoryProjection = {
  facts: Array<{
    handle: string;
    statement: string;
    state: "proposed" | "established" | "contested" | "superseded";
    evidenceLevel: "declared" | "supported" | "corroborated" | "contested";
    provenance: MemoryProvenance;
    contested: boolean;
    superseded: boolean;
    effectiveFrom: string;
    effectiveUntil: string | null;
    establishedAt: string | null;
  }>;
  decisions: Array<{
    handle: string;
    title: string;
    rationale: string;
    state: "draft" | "validated" | "superseded" | "cancelled";
    provenance: MemoryProvenance;
    decidedAt: string;
    validatedAt: string | null;
  }>;
  sources: Array<{
    handle: string;
    title: string;
    type: string;
    state: string;
    provenance: { actorOrigin: MemoryActorOrigin | null; recordedAt: string };
    available: boolean;
  }>;
  pending: Array<{ kind: "fact" | "decision"; handle: string; label: string; recordedAt: string }>;
  capabilities: JourneyMemoryCapabilities;
};
