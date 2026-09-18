import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GovernedMemoryAIContextService, assertAuthorizedAIContextEgress, resolveAuthorizedAIHandle } from "../lib/ai/governance/context.ts";
import type { GovernedAIContextSnapshot, GovernedMemoryAIContextRepository, PreparedAuthorizedAIContext } from "../lib/ai/governance/context.ts";
import { projectGovernedJourneyCurrentState } from "../lib/governed-journey-current-state.ts";

const now = new Date("2026-09-19T10:00:00.000Z");
const currentStateInput = { memory: { decisionsInForce: 1, draftDecisions: 0, disputedDecisions: 0, establishedFacts: 1, disputedFacts: 0, proposedFacts: 0, activeSources: 1 }, participantCount: 2, activeRoleCount: 1, vacantRoleCount: 0, expectedDocumentCount: 1, receivedDocumentCount: 1, pendingReviewCount: 0, unscheduledMeetingCount: 0, meetingWithoutParticipantCount: 0, meetings: [], now };
const base: GovernedAIContextSnapshot = {
  journeyId: "journey-a", ownerId: "owner-a", actorId: "actor-a", currentStateInput,
  canViewMemory: true, canViewSources: true,
  facts: [{ id: "internal-fact-uuid", statement: "Le budget est validé.", status: "ESTABLISHED", effectiveFrom: now, effectiveUntil: null }],
  decisions: [{ id: "internal-decision-uuid", title: "Lancer le projet", rationale: "Accord collectif", status: "VALIDATED", effectiveFrom: now, effectiveUntil: null }],
  sources: [{ id: "internal-source-uuid", title: "Compte rendu", kind: "DOCUMENT", status: "ACTIVE", excerpt: "Validation en séance", recordedAt: now }],
};
function repository(snapshot: GovernedAIContextSnapshot | null = base): GovernedMemoryAIContextRepository { return { async readAuthorizedSnapshot() { return snapshot; } }; }
const service = (snapshot: GovernedAIContextSnapshot | null = base) => new GovernedMemoryAIContextService(repository(snapshot), () => now);

test("refuses absent Journey access, foreign owner, foreign Journey and forged client scope", async () => {
  for (const input of [{ journeyId: "journey-a", actorId: "denied" }, { journeyId: "journey-foreign", actorId: "actor-a" }]) {
    await assert.rejects(() => service(null).build({ ...input, capability: "explainCurrentState" }), /AI_CONTEXT_NOT_AUTHORIZED/);
  }
  await assert.rejects(() => service({ ...base, journeyId: "journey-other" }).build({ journeyId: "journey-a", actorId: "actor-a", capability: "explainCurrentState" }), /AI_CONTEXT_NOT_AUTHORIZED/);
});

test("builds explainCurrentState from the unchanged deterministic projection only", async () => {
  const prepared = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "explainCurrentState" });
  const data = prepared.context.data as any;
  assert.deepEqual(data.TRUSTED_SYSTEM_CONTEXT.currentState, projectGovernedJourneyCurrentState(currentStateInput));
  assert.deepEqual(data.GOVERNED_FACTS, []);
  assert.deepEqual(data.GOVERNED_DECISIONS, []);
  assert.deepEqual(data.UNTRUSTED_SOURCE_CONTENT, []);
  assert.equal(JSON.stringify(data).includes("history"), false);
  assert.equal(prepared.classification, "INTERNAL");
});

test("VIEW_MEMORY is mandatory for memory capabilities", async () => {
  await assert.rejects(() => service({ ...base, canViewMemory: false, facts: [], decisions: [], sources: [] }).build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" }), /AI_CONTEXT_NOT_AUTHORIZED/);
});

test("VIEW_SOURCES independently hides sources, titles, excerpts, handles and counts", async () => {
  const prepared = await service({ ...base, canViewSources: false }).build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const serialized = JSON.stringify(prepared.context.data);
  assert.doesNotMatch(serialized, /Compte rendu|Validation en séance|internal-source|S1|sourceCount/);
  assert.equal(prepared.handles.has("S1"), false);
});

test("VIEW_SOURCES includes only repository-authorized sources as opaque untrusted blocks", async () => {
  const prepared = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const data = prepared.context.data as any;
  assert.equal(data.UNTRUSTED_SOURCE_CONTENT[0].handle, "S1");
  assert.equal(data.UNTRUSTED_SOURCE_CONTENT[0].trust, "UNTRUSTED");
  assert.doesNotMatch(JSON.stringify(data), /internal-source-uuid/);
  assert.deepEqual(resolveAuthorizedAIHandle(prepared, "S1"), { category: "SOURCE", objectId: "internal-source-uuid", journeyId: "journey-a", ownerId: "owner-a" });
});

test("rejects unknown or forged handles", async () => {
  const prepared = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  assert.throws(() => resolveAuthorizedAIHandle(prepared, "S999"), /AI_CONTEXT_INVALID/);
  assert.throws(() => resolveAuthorizedAIHandle(prepared, "internal-source-uuid"), /AI_CONTEXT_INVALID/);
});

test("removes secrets, tokens, credentials, API keys and unnecessary emails", async () => {
  const snapshot = { ...base, sources: [{ ...base.sources[0], title: "person@example.test", excerpt: "token=guest-secret api_key=raw credential=private" }] };
  const prepared = await service(snapshot).build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const serialized = JSON.stringify(prepared.context.data);
  assert.doesNotMatch(serialized, /person@example|guest-secret|api_key=raw|credential=private/);
  assert.match(serialized, /REDACTED/);
});

test("computes maximum classification from included categories", async () => {
  const withSources = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const withoutSources = await service({ ...base, canViewSources: false }).build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  assert.equal(withSources.classification, "SENSITIVE");
  assert.equal(withoutSources.classification, "CONFIDENTIAL");
});

test("refuses oversized contexts instead of silently taking the first N", async () => {
  const facts = Array.from({ length: 61 }, (_, index) => ({ ...base.facts[0], id: `fact-${index}`, statement: `Fait ${index}` }));
  await assert.rejects(() => service({ ...base, facts, decisions: [], sources: [] }).build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" }), /AI_CONTEXT_TOO_LARGE/);
});

test("fingerprint is stable and changes with authorized content", async () => {
  const first = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const second = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const changed = await service({ ...base, facts: [{ ...base.facts[0], statement: "Contenu changé" }] }).build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.notEqual(first.fingerprint, changed.fingerprint);
});

test("egress rejects tampering before any router or provider call", async () => {
  const prepared = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "explainCurrentState" });
  const tampered = { ...prepared, context: { ...prepared.context, data: { token: "forged" } } } as PreparedAuthorizedAIContext;
  assert.throws(() => assertAuthorizedAIContextEgress(tampered), /AI_CONTEXT_INVALID/);
  const source = readFileSync("lib/ai/governance/context.ts", "utf8");
  assert.doesNotMatch(source, /routeAI\(|getAIProviderDeployments|\.adapter\.chat/);
});

test("provenance metadata contains no business content and authorization is single-use", async () => {
  const prepared = await service().build({ journeyId: "journey-a", actorId: "actor-a", capability: "summarizeAuthorizedMemory" });
  const metadata = { capability: prepared.capability, fingerprint: prepared.fingerprint, classification: prepared.classification, objectCount: prepared.objectCount, objectCategories: prepared.objectCategories, authorizationScope: prepared.authorizationScope };
  assert.doesNotMatch(JSON.stringify(metadata), /budget|Compte rendu|Accord collectif|internal-/);
  assert.equal(prepared.authorizationScope, "SINGLE_EXECUTION");
});

test("server runtime resolves the actor and Prisma stays behind a narrow repository", () => {
  const runtime = readFileSync("lib/ai/governance/context-runtime.ts", "utf8");
  const repository = readFileSync("lib/ai/governance/context-repository.ts", "utf8");
  assert.match(runtime, /getCurrentPrismaUser/);
  assert.doesNotMatch(runtime, /actorId:\s*input/);
  assert.match(repository, /hasCurrentJourneyAccess/);
  assert.match(repository, /PrismaGovernedMemoryReadRepository/);
  assert.match(repository, /readGovernedJourneyCurrentStateMemoryCounts/);
  assert.doesNotMatch(repository, /records\.facts\.filter.*establishedFacts/s);
  assert.doesNotMatch(readFileSync("lib/ai/governance/context.ts", "utf8"), /@prisma|prisma\./i);
});
