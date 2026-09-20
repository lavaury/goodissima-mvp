import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("components/GovernedJourneyAddParticipantPanel.tsx");
const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
const route = read("app/api/gouvernance/invitations/route.ts");
const require = createRequire(import.meta.url);
const { NextResponse } = require("next/server");

function invitationRouteFixture({ ownerCanAccess = true, duplicate = false, profileUserId = "user-alice", workspaceId = "workspace-a" as string | null } = {}) {
  const writes: any[] = [];
  const consentWrites: any[] = [];
  const eventWrites: any[] = [];
  const module = loadTestModule("app/api/gouvernance/invitations/route.ts", {
    "next/server": { NextResponse },
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, PrismaClientKnownRequestError: class extends Error {} } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner-a" }) },
    "@/lib/governed-journey-invitations": { createJourneyInvitationToken: () => "secure-token", hashJourneyInvitationToken: () => "secure-hash" },
    "@/lib/governed-journey-expected-roles": { expectedRolesFromSnapshot: () => [] },
    "@/lib/governed-journey-role-assignments": { releaseUnavailableExpectedRoleAssignment: async () => null },
    "@/lib/governed-journey-authority": { resolveOwnedGovernedJourney: async (_client: unknown, input: { formTemplateId: string; authorityUserId: string }) => {
      assert.deepEqual(input, { formTemplateId: "journey-a", authorityUserId: "owner-a" });
      return ownerCanAccess ? { id: "root-a", relationTemplateId: "relation-a", workspaceId, status: "DRAFT" } : null;
    } },
    "@/lib/prisma": { prisma: {
      formTemplate: { findUnique: async (query: any) => {
        assert.deepEqual(query.where, { id: "journey-a" });
        return ownerCanAccess ? { relationTemplate: { id: "relation-a", workspaceId } } : null;
      } },
      directoryProfile: { findFirst: async (query: any) => {
        assert.equal(query.where.publicId, "directory-person");
        assert.equal(query.where.status, "PUBLISHED");
        return { publicId: "directory-person", publicName: "Alice Exemple", subjectIdentity: { user: { id: profileUserId } } };
      } },
      governedJourneyInvitation: { create: async (query: any) => { writes.push(query); return { id: "invitation-a" }; } },
      governedJourneyConsent: { create: async (query: any) => { consentWrites.push(query); return { id: "consent-a", version: 0 }; } },
      governedJourneyConsentEvent: { create: async (query: any) => { eventWrites.push(query); return { id: "event-a" }; } },
      relationCase: { findFirst: async () => null },
      $transaction: async (run: any, options: any) => {
        assert.equal(options.isolationLevel, "Serializable");
        return run({
        governedJourneyInvitation: {
          findFirst: async () => duplicate ? { id: "existing" } : null,
          create: async (query: any) => { writes.push(query); return { id: "invitation-a", role: "OTHER" }; },
        },
        governedJourneyConsent: { create: async (query: any) => { consentWrites.push(query); return { id: "consent-a", version: 0 }; } },
        governedJourneyConsentEvent: { create: async (query: any) => { eventWrites.push(query); return { id: "event-a" }; } },
      }); },
    } },
  });
  return { POST: module.POST as (request: Request) => Promise<Response>, writes, consentWrites, eventWrites };
}

function directoryInvitationRequest() {
  return new Request("https://preview.invalid/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    formTemplateId: "journey-a", directoryPublicId: "directory-person", role: "OTHER", participantRole: "Participant", expiresInDays: 7,
  }) });
}

function externalInvitationRequest() {
  return new Request("https://preview.invalid/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    formTemplateId: "journey-a", displayName: "Pierre Durand", role: "OTHER", participantRole: "Joueur", expiresInDays: 7,
  }) });
}

test("a global participant action is independent from expected participant placeholders", () => {
  assert.match(page, /GovernedJourneyAddParticipantPanel/);
  assert.match(panel, /Ajouter un participant/);
  assert.match(panel, /Personne déjà dans Goodissima/);
  assert.doesNotMatch(panel, /participants\.map/);
});

test("a published Goodissima person can be invited without an email", () => {
  assert.match(panel, /directoryPublicId: selected\.publicId/);
  assert.doesNotMatch(panel, /type="email"|preparedEmail/);
  assert.match(route, /status: "PUBLISHED"/);
  assert.match(route, /actorType: "PERSON"/);
  assert.match(route, /subjectIdentity: \{ user: \{ isNot: null \} \}/);
  assert.match(route, /directoryPublicId/);
});

test("server ownership, duplicate and cross-owner guards remain authoritative", () => {
  assert.match(route, /resolveOwnedGovernedJourney\(prisma, \{ formTemplateId, authorityUserId: owner\.id \}\)/);
  assert.match(route, /ownerId: owner\.id/);
  assert.match(route, /status: \{ in: \["PREPARED", "ACTIVE"\] \}/);
  assert.match(route, /accessTokenExpiresAt: \{ gt: new Date\(\) \}/);
  assert.match(route, /status: 409/);
});

test("a Journey without Workspace can prepare an invitation and pending consent", async () => {
  const fixture = invitationRouteFixture({ workspaceId: null });
  const response = await fixture.POST(externalInvitationRequest());
  assert.equal(response.status, 200);
  assert.equal(fixture.writes[0].data.workspaceId, null);
  assert.equal(fixture.consentWrites[0].data.status, "PENDING");
});

test("the UI exposes only real secure links without automatic notification", () => {
  assert.match(route, /createJourneyInvitationToken/);
  assert.match(panel, /Copier le lien/);
  assert.match(panel, /aucune notification n’est envoyée automatiquement/);
  assert.match(panel, /choisit explicitement depuis son invitation/);
  assert.match(panel, /min-h-11/);
});

test("the server creates an owner-scoped dynamic invitation without a placeholder", async () => {
  const fixture = invitationRouteFixture();
  const response = await fixture.POST(directoryInvitationRequest());
  assert.equal(response.status, 200);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].data.displayName, "Alice Exemple");
  assert.equal(fixture.writes[0].data.metadata.directoryPublicId, "directory-person");
  assert.equal(fixture.writes[0].data.metadata.subjectUserId, "user-alice");
  assert.equal(fixture.writes[0].data.inviteeUserId, "user-alice");
  assert.equal(fixture.writes[0].data.status, "PREPARED");
  assert.equal(fixture.consentWrites.length, 1);
  assert.equal(fixture.consentWrites[0].data.status, "PENDING");
  assert.equal(fixture.eventWrites.length, 1);
  assert.equal(fixture.eventWrites[0].data.type, "CREATED");
  assert.equal(fixture.writes[0].data.metadata.preparedEmail, null);
  assert.equal((await response.json()).link, "https://preview.invalid/gouvernance/invitation/secure-token");
});

test("global directory and external invitations create consent but no role assignment", async () => {
  for (const request of [directoryInvitationRequest(), externalInvitationRequest()]) {
    const fixture = invitationRouteFixture();
    const response = await fixture.POST(request);
    assert.equal(response.status, 200);
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.consentWrites.length, 1);
    assert.equal(fixture.writes[0].data.metadata.expectedRoleId, null);
  }
});

test("duplicates and another owner's Journey are rejected before mutation", async () => {
  const duplicate = invitationRouteFixture({ duplicate: true });
  assert.equal((await duplicate.POST(directoryInvitationRequest())).status, 409);
  assert.equal(duplicate.writes.length, 0);
  const crossOwner = invitationRouteFixture({ ownerCanAccess: false });
  assert.equal((await crossOwner.POST(directoryInvitationRequest())).status, 400);
  assert.equal(crossOwner.writes.length, 0);
});

test("an organizer can invite their own published directory identity without auto-acceptance", async () => {
  const fixture = invitationRouteFixture({ profileUserId: "owner-a" });
  const response = await fixture.POST(directoryInvitationRequest());
  assert.equal(response.status, 200);
  assert.equal(fixture.writes[0].data.inviteeUserId, "owner-a");
  assert.equal(fixture.consentWrites[0].data.status, "PENDING");
  assert.equal(fixture.writes[0].data.status, "PREPARED");
});
