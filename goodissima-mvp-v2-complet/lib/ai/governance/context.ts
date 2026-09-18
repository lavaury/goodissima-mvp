import { createHash } from "node:crypto";
import { projectGovernedJourneyCurrentState } from "../../governed-journey-current-state.ts";
import type { GovernedJourneyCurrentState, GovernedJourneyCurrentStateInput } from "../../governed-journey-current-state.ts";
import { highestAIClassification } from "./policy.ts";
import { AIGovernanceError } from "./types.ts";
import type { AICapabilityId, AIDataClassification, AuthorizedAIContext } from "./types.ts";

export type GovernedAIContextFact = { id: string; statement: string; status: string; effectiveFrom: Date; effectiveUntil: Date | null };
export type GovernedAIContextDecision = { id: string; title: string; rationale: string; status: string; effectiveFrom: Date; effectiveUntil: Date | null };
export type GovernedAIContextSource = { id: string; title: string; kind: string; status: string; excerpt: string | null; recordedAt: Date };

export type GovernedAIContextSnapshot = {
  journeyId: string;
  ownerId: string;
  actorId: string;
  currentStateInput: GovernedJourneyCurrentStateInput;
  canViewMemory: boolean;
  canViewSources: boolean;
  facts: GovernedAIContextFact[];
  decisions: GovernedAIContextDecision[];
  sources: GovernedAIContextSource[];
};

export interface GovernedMemoryAIContextRepository {
  /** Returns null for absent, foreign-owner, foreign-Journey and unauthorized scopes. */
  readAuthorizedSnapshot(input: { journeyId: string; actorId: string; capability: AICapabilityId }): Promise<GovernedAIContextSnapshot | null>;
}

export type AIContextObjectCategory = "CURRENT_STATE" | "FACT" | "DECISION" | "SOURCE";
export type AuthorizedAIHandleTarget = { category: Exclude<AIContextObjectCategory, "CURRENT_STATE">; objectId: string; journeyId: string; ownerId: string };

export type PreparedAuthorizedAIContext = {
  context: AuthorizedAIContext;
  capability: AICapabilityId;
  classification: AIDataClassification;
  fingerprint: string;
  objectCount: number;
  objectCategories: AIContextObjectCategory[];
  authorizedAt: string;
  authorizationScope: "SINGLE_EXECUTION";
  handles: ReadonlyMap<string, AuthorizedAIHandleTarget>;
};

type ContextBudget = { maxObjects: number; maxSources: number; maxExcerptCharacters: number; maxTotalCharacters: number; maxRelationDepth: number };
const budgets: Partial<Record<AICapabilityId, ContextBudget>> = {
  explainCurrentState: { maxObjects: 1, maxSources: 0, maxExcerptCharacters: 0, maxTotalCharacters: 12_000, maxRelationDepth: 0 },
  summarizeAuthorizedMemory: { maxObjects: 60, maxSources: 20, maxExcerptCharacters: 800, maxTotalCharacters: 32_000, maxRelationDepth: 1 },
  compareObjects: { maxObjects: 10, maxSources: 4, maxExcerptCharacters: 600, maxTotalCharacters: 16_000, maxRelationDepth: 1 },
  detectPotentialContradiction: { maxObjects: 20, maxSources: 8, maxExcerptCharacters: 600, maxTotalCharacters: 24_000, maxRelationDepth: 1 },
};

const forbiddenKey = /(?:password|secret|token|credential|api[_-]?key|authorization|cookie|storagePath|fileUrl)/i;
const secretValue = /(?:bearer\s+[a-z0-9._~-]+|(?:api[_ -]?key|token|secret|password|credential)\s*[:=]\s*\S+)/gi;
const emailValue = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const secretDetection = /(?:bearer\s+[a-z0-9._~-]+|(?:api[_ -]?key|token|secret|password|credential)\s*[:=]\s*\S+)/i;
const emailDetection = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;

function cleanUntrustedText(value: string, max: number) {
  return value.replace(secretValue, "[REDACTED]").replace(emailValue, "[REDACTED_EMAIL]").slice(0, max);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function fingerprint(value: unknown) { return createHash("sha256").update(stable(value)).digest("hex"); }

function requirements(capability: AICapabilityId) {
  if (capability === "explainCurrentState") return { currentState: true, memory: false, sources: false };
  if (["summarizeAuthorizedMemory", "compareObjects", "detectPotentialContradiction"].includes(capability)) return { currentState: false, memory: true, sources: true };
  throw new AIGovernanceError("AI_CAPABILITY_UNAVAILABLE");
}

function opaque<T extends { id: string }>(prefix: "F" | "D" | "S", values: T[], snapshot: GovernedAIContextSnapshot, handles: Map<string, AuthorizedAIHandleTarget>, category: AuthorizedAIHandleTarget["category"]) {
  return values.map((value, index) => {
    const handle = `${prefix}${index + 1}`;
    handles.set(handle, { category, objectId: value.id, journeyId: snapshot.journeyId, ownerId: snapshot.ownerId });
    return { handle, value };
  });
}

export function resolveAuthorizedAIHandle(context: PreparedAuthorizedAIContext, handle: string) {
  const target = context.handles.get(handle);
  if (!target) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  return target;
}

export function assertAuthorizedAIContextEgress(prepared: PreparedAuthorizedAIContext) {
  const serialized = stable(prepared.context.data);
  if (forbiddenKey.test(serialized) || secretDetection.test(serialized) || emailDetection.test(serialized)) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  for (const target of prepared.handles.values()) if (serialized.includes(target.objectId)) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  const budget = budgets[prepared.capability];
  if (!budget || serialized.length > budget.maxTotalCharacters || prepared.objectCount > budget.maxObjects) throw new AIGovernanceError("AI_CONTEXT_TOO_LARGE");
  if (fingerprint(prepared.context.data) !== prepared.fingerprint) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  return true;
}

export class GovernedMemoryAIContextService {
  private readonly repository: GovernedMemoryAIContextRepository;
  private readonly now: () => Date;

  constructor(repository: GovernedMemoryAIContextRepository, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  async build(input: { journeyId: string; actorId: string; capability: AICapabilityId }): Promise<PreparedAuthorizedAIContext> {
    if (!input.journeyId.trim() || !input.actorId.trim()) throw new AIGovernanceError("AI_CONTEXT_NOT_AUTHORIZED");
    const required = requirements(input.capability);
    const snapshot = await this.repository.readAuthorizedSnapshot(input);
    if (!snapshot || snapshot.journeyId !== input.journeyId || snapshot.actorId !== input.actorId) throw new AIGovernanceError("AI_CONTEXT_NOT_AUTHORIZED");
    const budget = budgets[input.capability];
    if (!budget) throw new AIGovernanceError("AI_CAPABILITY_UNAVAILABLE");
    if (required.memory && !snapshot.canViewMemory) throw new AIGovernanceError("AI_CONTEXT_NOT_AUTHORIZED");
    const handles = new Map<string, AuthorizedAIHandleTarget>();
    const facts = required.memory ? opaque("F", snapshot.facts, snapshot, handles, "FACT") : [];
    const decisions = required.memory ? opaque("D", snapshot.decisions, snapshot, handles, "DECISION") : [];
    const sources = required.sources && snapshot.canViewSources ? opaque("S", snapshot.sources, snapshot, handles, "SOURCE") : [];
    const objectCount = (required.currentState ? 1 : 0) + facts.length + decisions.length + sources.length;
    if (objectCount > budget.maxObjects || sources.length > budget.maxSources) throw new AIGovernanceError("AI_CONTEXT_TOO_LARGE");

    const currentState: GovernedJourneyCurrentState | undefined = required.currentState
      ? projectGovernedJourneyCurrentState(snapshot.currentStateInput)
      : undefined;
    const data = {
      TRUSTED_SYSTEM_CONTEXT: { capability: input.capability, currentState },
      GOVERNED_FACTS: facts.map(({ handle, value }) => ({ handle, statement: cleanUntrustedText(value.statement, 2_000), status: value.status, effectiveFrom: value.effectiveFrom.toISOString(), effectiveUntil: value.effectiveUntil?.toISOString() ?? null })),
      GOVERNED_DECISIONS: decisions.map(({ handle, value }) => ({ handle, title: cleanUntrustedText(value.title, 500), rationale: cleanUntrustedText(value.rationale, 2_000), status: value.status, effectiveFrom: value.effectiveFrom.toISOString(), effectiveUntil: value.effectiveUntil?.toISOString() ?? null })),
      UNTRUSTED_SOURCE_CONTENT: sources.map(({ handle, value }) => ({ handle, title: cleanUntrustedText(value.title, 500), kind: value.kind, status: value.status, excerpt: value.excerpt ? cleanUntrustedText(value.excerpt, budget.maxExcerptCharacters) : null, recordedAt: value.recordedAt.toISOString(), trust: "UNTRUSTED" as const })),
      limits: { exhaustive: true, maxObjects: budget.maxObjects, maxSources: budget.maxSources, maxRelationDepth: budget.maxRelationDepth },
    };
    const classifications: AIDataClassification[] = ["INTERNAL"];
    if (facts.length || decisions.length) classifications.push("CONFIDENTIAL");
    if (sources.some(({ value }) => Boolean(value.excerpt))) classifications.push("SENSITIVE");
    const prepared: PreparedAuthorizedAIContext = {
      context: { type: `governed-journey:${input.capability}`, id: "journey-scope", data, authorizedObjectIds: [...handles.keys()] },
      capability: input.capability, classification: highestAIClassification(classifications), fingerprint: fingerprint(data),
      objectCount, objectCategories: [required.currentState ? "CURRENT_STATE" : null, facts.length ? "FACT" : null, decisions.length ? "DECISION" : null, sources.length ? "SOURCE" : null].filter((item): item is AIContextObjectCategory => Boolean(item)),
      authorizedAt: this.now().toISOString(), authorizationScope: "SINGLE_EXECUTION", handles,
    };
    assertAuthorizedAIContextEgress(prepared);
    return prepared;
  }
}
