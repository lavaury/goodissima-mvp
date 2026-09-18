import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as selectionDomain from "../lib/governed-meeting-participant-selection.ts";
import { hasCurrentJourneyAccess } from "../lib/governed-journey-access.ts";
import {
  classifyJourneyMemberEligibility,
  GOVERNED_PARTICIPANT_SELECTION_LIMIT,
  isJourneyMemberSelectable,
  projectJourneyMemberCandidates,
  summarizeJourneyMemberSelection,
} from "../lib/governed-meeting-participant-selection.ts";

const now = new Date("2026-09-18T12:00:00.000Z");
const future = new Date("2026-09-19T12:00:00.000Z");
const past = new Date("2026-09-17T12:00:00.000Z");
const invitation = (id: string, options: Record<string, unknown> = {}) => ({
  id,
  inviteeUserId: `user-${id}`,
  displayName: `Personne ${id}`,
  status: "ACTIVE" as const,
  revokedAt: null,
  accessTokenExpiresAt: future,
  consent: { status: "ACCEPTED" as const },
  inviteeUser: { name: `Personne ${id}`, email: `${id}@example.invalid` },
  ...options,
});
const project = (invitations: ReturnType<typeof invitation>[], participants: Array<{ id: string; governedJourneyInvitationId: string; status: "AUTHORIZED" | "REMOVED" }> = []) => projectJourneyMemberCandidates({
  organizer: { id: "owner", displayName: "Organisateur" },
  invitations,
  meetingParticipants: participants,
  now,
});

test("projects 1, 5, 20 and 100 Journey members without truncation", () => {
  for (const count of [1, 5, 20, 100]) {
    assert.equal(project(Array.from({ length: count }, (_, index) => invitation(String(index)))).length, count);
  }
  assert.equal(GOVERNED_PARTICIPANT_SELECTION_LIMIT, 100);
});

test("canonicalizes Goodissima users and keeps guests and equal names distinct", () => {
  const candidates = project([
    invitation("user-old", { inviteeUserId: "same-user", displayName: "Ancien alias", revokedAt: now, status: "REVOKED", inviteeUser: { name: "Nom public", email: "same@example.invalid" } }),
    invitation("user-current", { inviteeUserId: "same-user", displayName: "Nom public", inviteeUser: { name: "Nom public", email: "same@example.invalid" } }),
    invitation("guest", { inviteeUserId: null, displayName: "Nom public", inviteeUser: null }),
    invitation("other", { inviteeUserId: "different-user", displayName: "Nom public", inviteeUser: { name: "Nom public", email: "other@example.invalid" } }),
  ]);
  assert.equal(candidates.length, 3);
  assert.equal(candidates.filter((candidate) => candidate.canonicalUserId === "same-user").length, 1);
  assert.equal(candidates.find((candidate) => candidate.canonicalUserId === "same-user")?.sourceInvitationId, "user-current");
  assert.equal(candidates.filter((candidate) => candidate.displayName === "Nom public").length, 3);
  assert.equal(candidates.find((candidate) => candidate.canonicalInvitationId === "guest")?.key, "guest:guest");
});

test("an old revoked Hao Ping representation never creates a second candidate", () => {
  const candidates = project([
    invitation("hao-revoked", { inviteeUserId: "hao-user", displayName: "Hao Ping · Accès retiré", revokedAt: now, status: "REVOKED" }),
    invitation("hao-active", { inviteeUserId: "hao-user", displayName: "Hao Ping" }),
  ], [{ id: "historical-row", governedJourneyInvitationId: "hao-revoked", status: "REMOVED" }]);
  assert.deepEqual(candidates.map((candidate) => [candidate.key, candidate.sourceInvitationId, candidate.eligibility]), [["user:hao-user", "hao-active", "ELIGIBLE"]]);
});

test("classifies every eligibility and only allows eligible/current participants", () => {
  const cases = [
    [invitation("eligible"), false, "ELIGIBLE"],
    [invitation("present"), true, "ALREADY_PRESENT"],
    [invitation("pending", { status: "PREPARED", consent: { status: "PENDING" } }), false, "PENDING_CONSENT"],
    [invitation("declined", { status: "PREPARED", consent: { status: "DECLINED" } }), false, "DECLINED"],
    [invitation("revoked", { status: "REVOKED", revokedAt: now }), false, "REVOKED"],
    [invitation("expired", { status: "EXPIRED", accessTokenExpiresAt: past }), false, "EXPIRED"],
    [invitation("ineligible", { status: "PREPARED", consent: null }), false, "INELIGIBLE"],
  ] as const;
  for (const [value, present, expected] of cases) assert.equal(classifyJourneyMemberEligibility(value, present, now), expected);
  assert.equal(isJourneyMemberSelectable("ELIGIBLE"), true);
  assert.equal(isJourneyMemberSelectable("ALREADY_PRESENT"), true);
  for (const value of ["PENDING_CONSENT", "DECLINED", "REVOKED", "EXPIRED", "INELIGIBLE"] as const) assert.equal(isJourneyMemberSelectable(value), false);
});

test("detects an already-present canonical user across active invitation representations", () => {
  const candidates = project([
    invitation("a", { inviteeUserId: "same-user" }),
    invitation("b", { inviteeUserId: "same-user" }),
  ], [{ id: "participant", governedJourneyInvitationId: "a", status: "AUTHORIZED" }]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].eligibility, "ALREADY_PRESENT");
  assert.equal(candidates[0].existingMeetingParticipantId, "participant");
});

test("summarizes human inclusions and exclusions", () => {
  assert.deepEqual(summarizeJourneyMemberSelection([
    { decision: "INCLUDED", observedEligibility: "ELIGIBLE" },
    { decision: "INCLUDED", observedEligibility: "ALREADY_PRESENT" },
    { decision: "EXCLUDED", observedEligibility: "ELIGIBLE" },
  ]), { observed: 3, retained: 2, excluded: 1, toAdd: 1, alreadyPresent: 1 });
});

const actions = readFileSync("lib/governed-meeting-participant-selection-actions.ts", "utf8");
const component = readFileSync("components/GovernedMeetingParticipantSelection.tsx", "utf8");
const cockpit = readFileSync("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", "utf8");
const meetingRsvp = readFileSync("lib/governed-meeting-rsvp.ts", "utf8");
const boussoleGuide = readFileSync("lib/boussole-governed-journey.ts", "utf8");
const boussoleRegistry = readFileSync("lib/boussole/registry.ts", "utf8");

test("persists draft and review events without materializing early", () => {
  const beforeValidation = actions.slice(actions.indexOf("createJourneyMemberSelectionAction"), actions.indexOf("validateJourneyMemberSelectionAction"));
  assert.match(beforeValidation, /status: "DRAFT"/);
  assert.match(beforeValidation, /type: "CREATED"/);
  assert.match(beforeValidation, /type: "REVIEW_STARTED"/);
  assert.doesNotMatch(beforeValidation, /governedMeetingParticipant\.(?:create|upsert)/);
  assert.doesNotMatch(beforeValidation, /createPendingMeetingRsvp/);
});

test("materialization is scoped, versioned, atomic and reuses RSVP primitives", () => {
  assert.match(actions, /ownerId: owner\.id/);
  assert.match(actions, /governedJourneyId: scope\.journey\.id/);
  assert.match(actions, /communicationSessionId: scope\.session\.id/);
  assert.match(actions, /version: loaded\.selection\.version/);
  assert.match(actions, /TransactionIsolationLevel\.Serializable/);
  assert.match(actions, /const changed = revalidated\.filter/);
  assert.ok(actions.indexOf("if (changed.length)") < actions.indexOf("governedMeetingParticipant.upsert"));
  assert.match(actions, /governedMeetingParticipant\.upsert/);
  assert.match(actions, /createPendingMeetingRsvp/);
  assert.match(meetingRsvp, /createPendingMeetingRsvp[\s\S]*status: "PENDING"[\s\S]*type: "INVITED"/);
  assert.match(actions, /type: "VALIDATED"/);
  assert.match(actions, /type: "MATERIALIZED"/);
  assert.match(actions, /selection\.status === "MATERIALIZED"/);
  assert.doesNotMatch(actions, /governedJourneyExpectedRoleAssignment/);
});

test("cockpit keeps individual access and adds the compact governed selection UX", () => {
  assert.match(cockpit, /authorizeGuestForGovernedMeetingAction/);
  assert.match(cockpit, /GovernedMeetingParticipantSelection/);
  for (const wording of ["Ajouter une sélection", "Membres du Parcours", "Sélectionner tous les membres éligibles", "Examiner la sélection", "Valider les participants"]) assert.match(component, new RegExp(wording));
  assert.match(component, /PAGE_SIZE = 10/);
  assert.match(component, /items\.filter\(\(item\) => item\.observedEligibility === "ELIGIBLE"\)/);
  assert.match(component, /router\.refresh\(\)/);
  assert.doesNotMatch(actions, /source:\s*"(?:DIRECTORY|MATCHING)"/);
});

test("Boussole targets the real EMPTY, POPULATED and FOCUSED selection surface", () => {
  assert.match(component, /data-boussole-id="governed-meeting-participant-selection"/);
  for (const state of ["EMPTY", "POPULATED", "FOCUSED"]) assert.match(component, new RegExp(`"${state}"`));
  assert.match(boussoleGuide, /real-meeting-participant-selection/);
  assert.match(boussoleGuide, /ne sélectionne et n’ajoute personne/);
  assert.match(boussoleRegistry, /"governed-communications": 4/);
});

function runtimeFixture(options: { revoked?: boolean; materialized?: boolean; crossOwner?: boolean; crossJourney?: boolean; crossMeeting?: boolean; concurrent?: boolean } = {}) {
  const writes = { participants: 0, rsvps: 0, events: [] as string[], selectionStatuses: [] as string[] };
  const currentInvitation = invitation("runtime", { inviteeUserId: "runtime-user", ...(options.revoked ? { status: "REVOKED", revokedAt: now } : {}) });
  const selection = {
    id: "selection",
    ownerId: "owner",
    governedJourneyId: options.crossJourney ? "other-journey" : "journey",
    relationTemplateId: "template",
    communicationSessionId: options.crossMeeting ? "other-session" : "session",
    targetType: "MEETING",
    source: "JOURNEY_MEMBERS",
    status: options.materialized ? "MATERIALIZED" : "UNDER_REVIEW",
    version: options.materialized ? 3 : 1,
    materializationSummary: options.materialized ? { retained: 1, added: 1, alreadyPresent: 0, errors: 0 } : null,
    items: [{ id: "item", sourceInvitationId: "runtime", canonicalUserId: "runtime-user", canonicalInvitationId: null, snapshotDisplayName: "Runtime User", observedEligibility: "ELIGIBLE", decision: "INCLUDED" }],
  };
  const tx: any = {
    formTemplate: { findFirst: async () => options.crossOwner ? null : { relationTemplateId: "template" } },
    governedJourney: { findFirst: async () => ({ id: "journey", relationTemplateId: "template" }) },
    communicationSession: { findFirst: async () => ({ id: "session", ownerId: "owner", relationTemplateId: "template", status: "PREPARED_NOT_STARTED", expiresAt: future, rsvpRevision: 1 }) },
    governedParticipantSelection: {
      findFirst: async ({ where }: any) => where.governedJourneyId === selection.governedJourneyId && where.communicationSessionId === selection.communicationSessionId && where.targetType === selection.targetType ? selection : null,
      updateMany: async ({ data }: any) => {
        if (options.concurrent && data.status === "VALIDATED") return { count: 0 };
        writes.selectionStatuses.push(data.status);
        return { count: 1 };
      },
      update: async ({ data }: any) => { writes.selectionStatuses.push(data.status); return { ...selection, ...data }; },
    },
    governedParticipantSelectionItem: { update: async () => ({}) },
    governedParticipantSelectionEvent: { create: async ({ data }: any) => { writes.events.push(data.type); return data; } },
    governedJourneyInvitation: { findMany: async () => [currentInvitation] },
    governedMeetingParticipant: {
      findMany: async () => [],
      upsert: async () => { writes.participants += 1; return { id: "participant", rsvp: null, governedJourneyInvitation: currentInvitation }; },
    },
  };
  const prisma = { $transaction: async (operation: any) => operation(tx) };
  const actionsModule = loadTestModule<any>("lib/governed-meeting-participant-selection-actions.ts", {
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner", name: "Owner", email: "owner@example.invalid" }) },
    "@/lib/governed-journey-consent": { hasCurrentJourneyAccess },
    "@/lib/governed-meeting-rsvp": { createPendingMeetingRsvp: async () => { writes.rsvps += 1; return {}; } },
    "@/lib/governed-meeting-participant-selection": selectionDomain,
    "@/lib/prisma": { prisma },
  });
  return { actionsModule, writes };
}

const runtimeInput = { formTemplateId: "form", communicationSessionId: "session", selectionId: "selection", version: 1, selectedItemIds: ["item"] };

test("eligibility change stops the whole materialization and returns to review", async () => {
  const { actionsModule, writes } = runtimeFixture({ revoked: true });
  const result = await actionsModule.validateJourneyMemberSelectionAction(runtimeInput);
  assert.equal(result.ok, false);
  assert.equal(result.error, "La situation de certains participants a changé depuis votre examen.");
  assert.deepEqual(result.changedParticipants, ["Runtime User"]);
  assert.equal(writes.participants, 0);
  assert.equal(writes.rsvps, 0);
  assert.deepEqual(writes.events, []);
  assert.deepEqual(writes.selectionStatuses, ["VALIDATED", "UNDER_REVIEW"]);
});

test("successful validation materializes once, delegates RSVP and records both events", async () => {
  const { actionsModule, writes } = runtimeFixture();
  const result = await actionsModule.validateJourneyMemberSelectionAction(runtimeInput);
  assert.equal(result.ok, true);
  assert.equal(result.kind, "MATERIALIZED");
  assert.deepEqual(result.summary, { retained: 1, added: 1, alreadyPresent: 0, errors: 0 });
  assert.equal(writes.participants, 1);
  assert.equal(writes.rsvps, 1);
  assert.deepEqual(writes.events, ["VALIDATED", "MATERIALIZED"]);
});

test("cross-owner scope writes nothing and materialized retry is idempotent", async () => {
  const denied = runtimeFixture({ crossOwner: true });
  const deniedResult = await denied.actionsModule.validateJourneyMemberSelectionAction(runtimeInput);
  assert.equal(deniedResult.ok, false);
  assert.equal(denied.writes.participants, 0);
  assert.equal(denied.writes.rsvps, 0);

  const completed = runtimeFixture({ materialized: true });
  const completedResult = await completed.actionsModule.validateJourneyMemberSelectionAction(runtimeInput);
  assert.equal(completedResult.ok, true);
  assert.equal(completedResult.kind, "MATERIALIZED");
  assert.equal(completed.writes.participants, 0);
  assert.equal(completed.writes.rsvps, 0);
  assert.deepEqual(completed.writes.events, []);
});

test("cross-Journey, cross-meeting and concurrent validation are rejected without writes", async () => {
  for (const fixture of [
    runtimeFixture({ crossJourney: true }),
    runtimeFixture({ crossMeeting: true }),
    runtimeFixture({ concurrent: true }),
  ]) {
    const result = await fixture.actionsModule.validateJourneyMemberSelectionAction(runtimeInput);
    assert.equal(result.ok, false);
    assert.equal(fixture.writes.participants, 0);
    assert.equal(fixture.writes.rsvps, 0);
    assert.deepEqual(fixture.writes.events, []);
  }
});
