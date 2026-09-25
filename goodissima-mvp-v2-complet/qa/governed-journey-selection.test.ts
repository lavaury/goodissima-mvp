import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inviteSelectionToJourney } from "../lib/governed-journey-selection.ts";
import { hashJourneyInvitationToken } from "../lib/governed-journey-invitations.ts";
const runtime = readFileSync("lib/governed-journey-selection.ts", "utf8");
const directory = readFileSync("components/directory/DirectoryExperience.tsx", "utf8");
const matching = readFileSync("components/GLinkMatchingPanel.tsx", "utf8");
test("JOURNEY selection uses governed authority and supports caseless journeys", () => { assert.match(runtime, /targetType: "JOURNEY"/); assert.match(runtime, /authorityUserId: input\.authorityUserId/); assert.doesNotMatch(runtime, /relationCase.*(?:create|upsert)/); });
test("directory candidates are revalidated as published resolvable PERSON profiles", () => { for (const value of [/status: "PUBLISHED"/, /actorType: "PERSON"/, /deletedAt: null/, /subjectIdentity: \{ user: \{ isNot: null \}/]) assert.match(runtime, value); assert.match(directory, /Inviter dans un Parcours/); assert.match(directory, /Confirmer les invitations/); assert.match(directory, /source: "DIRECTORY"/); });
test("individual outcomes preserve pending consent and create no roles or RSVP", () => { for (const status of ["INVITED", "ALREADY_INVITED", "ALREADY_PRESENT", "SKIPPED"]) assert.match(runtime, new RegExp(status)); assert.match(runtime, /status: "PENDING"/); assert.doesNotMatch(runtime, /RoleAssignment\.create|governedMeetingParticipant\.create|Rsvp\.create|relationCase\.create|workspace\.create/); });
test("unresolved matching results are explicitly non-invitable", () => { assert.match(runtime, /input\.source === "DIRECTORY" \?/); assert.match(matching, /Non invitable dans un Parcours/); assert.doesNotMatch(runtime, /candidateEmail|email:/); });

test("new invitations return a usable one-time delivery URL while only their hash is persisted", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://goodissima.example";
  for (const workspaceId of [null, "workspace-1"]) {
    let invitationData: any; const auditValues: unknown[] = [];
    const tx: any = {
      governedJourney: { findFirst: async () => ({ id: "journey", relationTemplateId: "template", relationTemplate: { workspaceId } }) },
      directoryProfile: { findMany: async () => [{ id: "profile", publicId: "person", publicName: "Alice", subjectIdentity: { user: { id: "alice" } } }] },
      governedJourneyInvitation: { findMany: async () => [], create: async ({ data }: any) => { invitationData = data; return { id: "invitation" }; } },
      governedParticipantSelection: { create: async () => ({ id: "selection" }), update: async () => ({}) },
      governedParticipantSelectionEvent: { createMany: async ({ data }: any) => { auditValues.push(data); }, create: async ({ data }: any) => { auditValues.push(data); } },
      governedJourneyConsent: { create: async () => ({}) }, governedParticipantSelectionItem: { create: async () => ({}) },
    };
    const result = await inviteSelectionToJourney({ $transaction: async (run: any) => run(tx) } as any, { authorityUserId: "owner", journeyId: "journey", source: "DIRECTORY", candidateIds: ["person"] });
    const deliveryUrl = result.results[0].deliveryUrl!; const token = decodeURIComponent(new URL(deliveryUrl).pathname.split("/").pop()!);
    assert.match(deliveryUrl, /^https:\/\/goodissima\.example\/gouvernance\/invitation\//);
    assert.notEqual(invitationData.accessTokenHash, token); assert.equal(invitationData.accessTokenHash, hashJourneyInvitationToken(token));
    assert.equal(JSON.stringify(invitationData).includes(token), false); assert.equal(JSON.stringify(auditValues).includes(token), false);
    assert.equal(invitationData.workspaceId, workspaceId);
  }
});

test("existing, present and skipped results cannot fabricate delivery links", () => {
  assert.match(runtime, /deliveryUrl = buildPublicAppUrl/);
  assert.match(runtime, /\.\.\.\(deliveryUrl \? \{ deliveryUrl \} : \{\}\)/);
  assert.match(directory, /Copier le lien/);
});

test("mixed batch deduplicates ids and reports invited, pending, present and inaccessible profiles", async () => {
  const created: any[] = []; const items: any[] = [];
  const profiles = [
    { id: "profile-new", publicId: "new", publicName: "Alice", subjectIdentity: { user: { id: "user-new" } } },
    { id: "profile-pending", publicId: "pending", publicName: "Bob", subjectIdentity: { user: { id: "user-pending" } } },
    { id: "profile-present", publicId: "present", publicName: "Claire", subjectIdentity: { user: { id: "user-present" } } },
  ];
  const tx: any = {
    governedJourney: { findFirst: async (query: any) => { assert.equal(query.where.id, "journey"); assert.equal(query.where.authorityUserId, "owner"); return { id: "journey", relationTemplateId: "template", relationTemplate: { workspaceId: null } }; } },
    directoryProfile: { findMany: async (query: any) => { assert.equal(query.where.actorType, "PERSON"); assert.equal(query.where.status, "PUBLISHED"); return profiles; } },
    governedJourneyInvitation: { findMany: async () => [
      { id: "inv-pending", inviteeUserId: "user-pending", status: "PREPARED", consent: { status: "PENDING" } },
      { id: "inv-present", inviteeUserId: "user-present", status: "ACTIVE", consent: { status: "ACCEPTED" } },
    ], create: async ({ data }: any) => { created.push(data); return { id: "inv-new" }; } },
    governedParticipantSelection: { create: async () => ({ id: "selection" }), update: async () => ({}) },
    governedParticipantSelectionEvent: { createMany: async () => ({}), create: async () => ({}) },
    governedJourneyConsent: { create: async () => ({}) },
    governedParticipantSelectionItem: { create: async ({ data }: any) => { items.push(data); return {}; } },
  };
  const result = await inviteSelectionToJourney({ $transaction: async (run: any) => run(tx) } as any, { authorityUserId: "owner", journeyId: "journey", source: "DIRECTORY", candidateIds: ["new", "pending", "present", "missing", "new"] });
  assert.deepEqual(result.results.map((item) => item.status), ["INVITED", "ALREADY_INVITED", "ALREADY_PRESENT", "SKIPPED"]);
  assert.deepEqual(result.summary, { invited: 1, alreadyInvited: 1, alreadyPresent: 1, skipped: 1 });
  assert.equal(created.length, 1);
  assert.equal(items.length, 4);
  assert.equal(result.results[0].deliveryUrl !== undefined, true);
  for (const item of result.results.slice(1)) assert.equal(item.deliveryUrl, undefined);
});
