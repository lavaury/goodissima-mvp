import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decisionIsInForce, factIsCurrent, projectGovernedJourneyCurrentState, type GovernedJourneyCurrentStateInput } from "../lib/governed-journey-current-state.ts";
import { projectGovernedJourneyExperience } from "../lib/governed-journey-experience.ts";

const now = new Date("2026-09-19T12:00:00.000Z");
const emptyMemory = { decisionsInForce: 0, draftDecisions: 0, disputedDecisions: 0, establishedFacts: 0, disputedFacts: 0, proposedFacts: 0, activeSources: 0 };
const base: GovernedJourneyCurrentStateInput = { memory: emptyMemory, participantCount: 0, activeRoleCount: 0, vacantRoleCount: 0, expectedDocumentCount: 0, receivedDocumentCount: 0, pendingReviewCount: 0, unscheduledMeetingCount: 0, meetingWithoutParticipantCount: 0, meetings: [], now };
const project = (overrides: Partial<GovernedJourneyCurrentStateInput> = {}) => projectGovernedJourneyCurrentState({ ...base, ...overrides });
const decision = (status: "DRAFT" | "VALIDATED" | "SUPERSEDED" | "CANCELLED", effectiveFrom: Date | null = now, effectiveUntil: Date | null = null) => ({ status, effectiveFrom, effectiveUntil });
const fact = (status: "PROPOSED" | "ESTABLISHED" | "DISPUTED" | "SUPERSEDED", effectiveFrom = now, effectiveUntil: Date | null = null, supersededByFactId: string | null = null) => ({ status, effectiveFrom, effectiveUntil, supersededByFactId });

test("an empty governed state renders no optional block", () => {
  const state = project();
  assert.deepEqual(state, { decisions: null, facts: null, sources: null, peopleAndRoles: null, clarifications: [], nextMeeting: null });
});

test("only temporally applicable validated decisions are in force", () => {
  assert.equal(decisionIsInForce(decision("DRAFT"), now), false);
  assert.equal(decisionIsInForce(decision("VALIDATED"), now), true);
  assert.equal(decisionIsInForce(decision("SUPERSEDED"), now), false);
  assert.equal(decisionIsInForce(decision("CANCELLED"), now), false);
  assert.equal(decisionIsInForce(decision("VALIDATED", new Date("2026-09-20T00:00:00Z")), now), false);
  assert.equal(decisionIsInForce(decision("VALIDATED", null, new Date("2026-09-19T11:00:00Z")), now), false);
});

test("coexisting validated decisions are all counted", () => {
  assert.equal(project({ memory: { ...emptyMemory, decisionsInForce: 2 } }).decisions?.count, 2);
});

test("an open dispute clarifies but does not cancel a decision", () => {
  const state = project({ memory: { ...emptyMemory, decisionsInForce: 1, disputedDecisions: 1 } });
  assert.equal(state.decisions?.count, 1);
  assert.ok(state.clarifications.some((item) => item.kind === "disputed-decision"));
});

test("facts distinguish proposed, established, disputed and superseded states", () => {
  assert.equal(factIsCurrent(fact("PROPOSED"), now), false);
  assert.equal(factIsCurrent(fact("ESTABLISHED"), now), true);
  assert.equal(factIsCurrent(fact("DISPUTED"), now), true);
  assert.equal(factIsCurrent(fact("SUPERSEDED"), now), false);
  assert.equal(factIsCurrent(fact("ESTABLISHED", now, null, "new-fact"), now), false);
  const state = project({ memory: { ...emptyMemory, establishedFacts: 3, disputedFacts: 1, proposedFacts: 2 } });
  assert.deepEqual(state.facts && { established: state.facts.establishedCount, disputed: state.facts.disputedCount }, { established: 3, disputed: 1 });
  assert.ok(state.clarifications.some((item) => item.kind === "proposed-fact"));
});

test("sources remain distinct and disappear entirely without VIEW_SOURCES", () => {
  const visible = project({ memory: { ...emptyMemory, establishedFacts: 0, activeSources: 4 } });
  assert.equal(visible.sources?.activeCount, 4);
  assert.equal(visible.facts, null, "a source never creates a fact");
  assert.equal(project({ memory: { ...emptyMemory, activeSources: null } }).sources, null);
});

test("current people and active roles are supplied by canonical current projections", () => {
  const state = project({ participantCount: 2, activeRoleCount: 1 });
  assert.deepEqual(state.peopleAndRoles, { participantCount: 2, activeRoleCount: 1, vacantRoleCount: 0, href: "#people" });
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  assert.match(page, /participantCount: canonicalPeople\.length/);
  assert.match(page, /activeJourneyInvitations = governedInvitations\.filter/);
  assert.match(page, /expectedRoleAssignments: \{ where: \{ revokedAt: null \}/);
});

test("vacant roles and unresolved business states are descriptive clarifications", () => {
  const state = project({ vacantRoleCount: 1, expectedDocumentCount: 2, receivedDocumentCount: 1, pendingReviewCount: 1, unscheduledMeetingCount: 1, meetingWithoutParticipantCount: 1 });
  assert.deepEqual(state.clarifications.map((item) => item.kind), ["expected-document", "vacant-role", "pending-review", "unscheduled-meeting", "meeting-without-participant"]);
  assert.ok(state.clarifications.every((item) => !/^(Invitez|Fixez|Choisir|Examiner|Poursuivre)/.test(item.label)));
});

test("the next meeting uses scheduledAt only and selects the nearest future open meeting", () => {
  const state = project({ meetings: [
    { id: "late", title: "Tard", status: "PREPARED_NOT_STARTED", accessOpened: false, scheduledAt: new Date("2026-09-22T10:00:00Z"), expiresAt: null },
    { id: "near", title: "Proche", status: "PREPARED_NOT_STARTED", accessOpened: false, scheduledAt: new Date("2026-09-20T10:00:00Z"), expiresAt: null },
    { id: "past", title: "Passée", status: "PREPARED_NOT_STARTED", accessOpened: false, scheduledAt: new Date("2026-09-18T10:00:00Z"), expiresAt: null },
    { id: "closed", title: "Terminée", status: "COMPLETED", accessOpened: false, scheduledAt: new Date("2026-09-19T13:00:00Z"), expiresAt: null },
  ] });
  assert.equal(state.nextMeeting?.id, "near");
  assert.equal("updatedAt" in (state.nextMeeting ?? {}), false);
});

test("more than five actions keeps the exhaustive total before display truncation", () => {
  const interventions = Array.from({ length: 7 }, (_, index) => ({ label: `Action ${index}`, detail: "Réelle", href: `#${index}` }));
  const experience = projectGovernedJourneyExperience({ humanValidated: true, totalParticipants: 0, preparedInvitations: 0, totalDocuments: 0, receivedDocuments: 0, pendingReviews: 0, interventions });
  assert.equal(experience.actions.length, 5);
  assert.equal(experience.totalActionCount, 7);
  assert.match(experience.situation, /^7 actions/);
});

test("current-state memory counts are exhaustive targeted database counts, never the 100-row read model", () => {
  const repository = readFileSync(new URL("../lib/governed-journey-current-state-memory.ts", import.meta.url), "utf8");
  assert.match(repository, /governedMemoryDecision\.count/);
  assert.match(repository, /governedMemoryFact\.count/);
  assert.match(repository, /governedMemorySource\.count/);
  assert.doesNotMatch(repository, /take:\s*100|JOURNEY_MEMORY_PAGE_SIZE|findMany/);
});

test("current state never consumes the journal and uses no AI", () => {
  const projection = readFileSync(new URL("../lib/governed-journey-current-state.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  const construction = page.slice(page.indexOf("const currentState ="), page.indexOf("const memoryRights"));
  assert.doesNotMatch(`${projection}\n${construction}`, /journeyHistory|GovernedJourneyEvent|\bAI\b|mistral|openai/i);
});
