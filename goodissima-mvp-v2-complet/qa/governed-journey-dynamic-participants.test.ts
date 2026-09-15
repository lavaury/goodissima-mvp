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

function invitationRouteFixture({ ownerCanAccess = true, duplicate = false } = {}) {
  const writes: any[] = [];
  const module = loadTestModule("app/api/gouvernance/invitations/route.ts", {
    "next/server": { NextResponse },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner-a" }) },
    "@/lib/governed-journey-invitations": { createJourneyInvitationToken: () => "secure-token", hashJourneyInvitationToken: () => "secure-hash" },
    "@/lib/prisma": { prisma: {
      formTemplate: { findFirst: async (query: any) => {
        assert.deepEqual(query.where, { id: "journey-a", relationTemplate: { workspace: { ownerId: "owner-a" } } });
        return ownerCanAccess ? { relationTemplate: { id: "relation-a", workspaceId: "workspace-a" } } : null;
      } },
      directoryProfile: { findFirst: async (query: any) => {
        assert.equal(query.where.publicId, "directory-person");
        assert.equal(query.where.status, "PUBLISHED");
        return { publicId: "directory-person", publicName: "Alice Exemple", subjectIdentity: { user: { id: "user-alice" } } };
      } },
      governedJourneyInvitation: {
        findFirst: async () => duplicate ? { id: "existing" } : null,
        create: async (query: any) => { writes.push(query); return { id: "invitation-a" }; },
      },
      relationCase: { findFirst: async () => null },
    } },
  });
  return { POST: module.POST as (request: Request) => Promise<Response>, writes };
}

function directoryInvitationRequest() {
  return new Request("https://preview.invalid/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    formTemplateId: "journey-a", directoryPublicId: "directory-person", role: "OTHER", participantRole: "Participant", expiresInDays: 7,
  }) });
}

test("a global participant action is independent from expected participant placeholders", () => {
  assert.match(page, /GovernedJourneyAddParticipantPanel/);
  assert.match(panel, />Ajouter un participant</);
  assert.match(panel, /Rechercher dans Goodissima/);
  assert.doesNotMatch(panel, /participants\.map|participant attendu/i);
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
  assert.match(route, /workspace: \{ ownerId: owner\.id \}/);
  assert.match(route, /ownerId: owner\.id/);
  assert.match(route, /status: "ACTIVE"/);
  assert.match(route, /accessTokenExpiresAt: \{ gt: new Date\(\) \}/);
  assert.match(route, /status: 409/);
});

test("the UI exposes only real secure links and no consent fiction", () => {
  assert.match(route, /createJourneyInvitationToken/);
  assert.match(panel, /Copier le lien/);
  assert.match(panel, /aucune notification n’est envoyée automatiquement/);
  assert.match(panel, /ne suit pas encore l’acceptation formelle/);
  assert.doesNotMatch(panel, />Accepter<|>Refuser</);
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
  assert.equal(fixture.writes[0].data.metadata.preparedEmail, null);
  assert.equal((await response.json()).link, "https://preview.invalid/gouvernance/invitation/secure-token");
});

test("duplicates and another owner's Journey are rejected before mutation", async () => {
  const duplicate = invitationRouteFixture({ duplicate: true });
  assert.equal((await duplicate.POST(directoryInvitationRequest())).status, 409);
  assert.equal(duplicate.writes.length, 0);
  const crossOwner = invitationRouteFixture({ ownerCanAccess: false });
  assert.equal((await crossOwner.POST(directoryInvitationRequest())).status, 400);
  assert.equal(crossOwner.writes.length, 0);
});
