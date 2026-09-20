import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GovernedMemoryReadService } from "../lib/governed-memory/service.ts";
import type { GovernedMemoryReadRepository, JourneyMemoryAccessRecord, JourneyMemoryRecords } from "../lib/governed-memory/repository.ts";

const at = new Date("2026-09-15T12:00:00.000Z");
const access: JourneyMemoryAccessRecord = { journeyId: "journey-a", relationCaseIds: ["case-a"], wholeJourney: false, roles: [], permissions: ["VIEW_MEMORY", "VIEW_SOURCES"] };
const empty: JourneyMemoryRecords = { facts: [], decisions: [], sources: [], disputes: [], validations: [], relations: [], events: [], transitionRequests: [] };

function repo(options: { access?: JourneyMemoryAccessRecord | null; records?: Partial<JourneyMemoryRecords> } = {}) {
  const reads: Array<{ journeyId: string; relationCaseIds: string[]; wholeJourney: boolean; includeSources: boolean }> = [];
  const repository: GovernedMemoryReadRepository = {
    async findJourneyAccess() { return options.access === undefined ? access : options.access; },
    async readJourneyMemory(journeyId, relationCaseIds, wholeJourney, includeSources) {
      reads.push({ journeyId, relationCaseIds, wholeJourney, includeSources });
      return { ...empty, ...options.records };
    },
  };
  return { repository, reads };
}

function fact(status = "ESTABLISHED") { return { id: "fact-a", statement: "Fait établi", status, evidenceLevel: "SUPPORTED", recordedAt: at, effectiveFrom: at, effectiveUntil: null, establishedAt: status === "ESTABLISHED" ? at : null, supersededByFactId: null }; }
function decision(status = "VALIDATED") { return { id: "decision-a", title: "Décision validée", rationale: "Motif", status, recordedAt: at, decidedAt: at, validatedAt: status === "VALIDATED" ? at : null }; }
function source(id = "source-a") { return { id, title: `Rapport ${id}`, kind: "DOCUMENT", status: "ACTIVE", recordedAt: at, unavailableReason: null }; }
function event(id: string, type: string, objectType: string, objectId: string, actorType = "HUMAN", occurredAt = at) { return { id, type, objectType, objectId, actorType, occurredAt, recordedAt: occurredAt }; }

test("empty memory returns a user-facing empty projection", async () => {
  const setup = repo();
  const result = await new GovernedMemoryReadService(setup.repository, () => at).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(result && { facts: result.facts, decisions: result.decisions, sources: result.sources, pending: result.pending }, { facts: [], decisions: [], sources: [], pending: [] });
});

test("established fact, validated decision and active source stay distinct", async () => {
  const setup = repo({ records: { facts: [fact()], decisions: [decision()], sources: [source()] } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.equal(result?.facts[0].state, "established");
  assert.equal(result?.decisions[0].state, "validated");
  assert.deepEqual(result?.sources.map((item) => item.handle), ["source-a"]);
  assert.equal(result?.facts.length, 1, "a source never creates or qualifies a fact");
});

test("contradictory sources coexist without inferred truth", async () => {
  const setup = repo({ records: { sources: [source("ballistics-a"), source("ballistics-b")] } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(result?.sources.map((item) => item.handle), ["ballistics-a", "ballistics-b"]);
  assert.deepEqual(result?.facts, []);
});

test("open disputes and supersession describe current state without erasing records", async () => {
  const superseded = { ...fact("SUPERSEDED"), id: "old-fact", supersededByFactId: "new-fact" };
  const contested = { ...fact(), id: "contested-fact" };
  const setup = repo({ records: { facts: [superseded, contested], disputes: [{ targetType: "FACT", targetId: "contested-fact", status: "OPEN" }] } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(result?.facts.map((item) => [item.handle, item.state]), [["old-fact", "superseded"], ["contested-fact", "contested"]]);
});

test("pending contains only proposed facts and draft decisions", async () => {
  const setup = repo({ records: { facts: [fact("PROPOSED"), fact("ESTABLISHED")], decisions: [decision("DRAFT"), decision("VALIDATED")], events: [event("event", "FACT_PROPOSED", "FACT", "fact-a", "SYSTEM")], transitionRequests: [{ id: "review-like-work" }] } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(result?.pending.map((item) => item.kind), ["fact", "decision"]);
  assert.equal(result?.facts[0].provenance.actorOrigin, "SYSTEM");
});

test("memory events are humanized, compact and stably ordered", async () => {
  const earlier = new Date("2026-09-14T12:00:00.000Z");
  const setup = repo({ records: {
    facts: [fact()], decisions: [decision()], sources: [source()],
    events: [
      event("a", "FACT_PROPOSED", "FACT", "fact-a"), event("b", "FACT_ESTABLISHED", "FACT", "fact-a"),
      event("c", "FACT_DISPUTED", "FACT", "fact-a"), event("d", "DECISION_RECORDED", "DECISION", "decision-a"),
      event("e", "DECISION_VALIDATED", "DECISION", "decision-a"), event("f", "SOURCE_REGISTERED", "SOURCE", "source-a", "SYSTEM", earlier),
    ],
  } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(result?.history.map((item) => item.handle), ["e", "d", "c", "b", "a", "f"]);
  assert.deepEqual(result?.history.map((item) => item.action), ["a confirmé une décision.", "a préparé une décision.", "a contesté un fait.", "a confirmé un fait.", "a proposé un fait.", "a ajouté une source."]);
  assert.equal(result?.history.at(-1)?.actorLabel, "Goodissima");
  assert.equal(result?.history.at(-1)?.objectLabel, "Rapport source-a");
});

test("source events reveal neither source detail nor source wording without VIEW_SOURCES", async () => {
  const setup = repo({ access: { ...access, permissions: ["VIEW_MEMORY"] }, records: { sources: [source()], events: [event("source-event", "SOURCE_REGISTERED", "SOURCE", "source-a")] } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(result?.history, [{ handle: "source-event", actorLabel: "Une personne", action: "a ajouté un élément à la mémoire.", objectLabel: null, occurredAt: at.toISOString() }]);
});

test("VIEW_MEMORY denial, foreign owner and absent journey are indistinguishable", async () => {
  for (const denied of [null, { ...access, permissions: ["VIEW_SOURCES"] as any }]) {
    const setup = repo({ access: denied });
    assert.equal(await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-foreign", "user-outsider"), null);
    assert.equal(setup.reads.length, 0);
  }
});

test("VIEW_SOURCES is enforced independently on the server", async () => {
  const setup = repo({ access: { ...access, permissions: ["VIEW_MEMORY"] }, records: { facts: [fact()], sources: [source()], relations: [{ sourceType: "SOURCE", sourceId: "source-a", targetType: "FACT", targetId: "fact-a" }] } });
  const result = await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.equal(setup.reads[0].includeSources, false);
  assert.deepEqual(result?.sources, []);
  assert.deepEqual(result?.facts[0].provenance.sourceHandles, []);
  assert.equal(result?.capabilities.canViewSources, false);
});

test("active memory roles produce explicit capabilities", async () => {
  const steward = repo({ access: { ...access, permissions: [], roles: ["MEMORY_STEWARD"] } });
  const delegate = repo({ access: { ...access, permissions: [], roles: ["MEMORY_DELEGATE"] } });
  assert.equal((await new GovernedMemoryReadService(steward.repository).readJourneyGovernedMemory("journey-a", "steward"))?.capabilities.canValidateDecision, true);
  assert.equal((await new GovernedMemoryReadService(delegate.repository).readJourneyGovernedMemory("journey-a", "delegate"))?.capabilities.canValidateDecision, false);
  assert.equal((await new GovernedMemoryReadService(delegate.repository).readJourneyGovernedMemory("journey-a", "delegate"))?.capabilities.canRegisterSource, true);
});

test("repository and service expose no mutation surface and events are read-only", () => {
  const repository = readFileSync(new URL("../lib/governed-memory/repository.ts", import.meta.url), "utf8");
  const service = readFileSync(new URL("../lib/governed-memory/service.ts", import.meta.url), "utf8");
  for (const sourceText of [repository, service]) assert.doesNotMatch(sourceText, /governedMemory(?:Fact|Decision|Source|Dispute|Validation|Relation|Event|TransitionRequest)\.(?:create|update|delete|upsert)/);
  assert.doesNotMatch(`${repository}\n${service}`, /prisma\.(?:governanceReview|governedJourneyEvent|communicationSession|document|message)\./i);
  assert.match(repository, /events are selected and projected, never mutated/);
});

test("all data reads remain scoped to the authorized journey", async () => {
  const setup = repo();
  await new GovernedMemoryReadService(setup.repository).readJourneyGovernedMemory("journey-a", "user-a");
  assert.deepEqual(setup.reads, [{ journeyId: "journey-a", relationCaseIds: ["case-a"], wholeJourney: false, includeSources: true }]);
});
