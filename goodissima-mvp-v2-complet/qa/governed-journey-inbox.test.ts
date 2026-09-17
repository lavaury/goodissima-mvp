import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const repository = read("lib/governed-journey-inbox.ts");
const page = read("app/(connected)/gouvernance/invitations/[id]/page.tsx");
const actions = read("lib/governed-journey-inbox-actions.ts");
const service = read("lib/governed-journey-consent.ts");
const governance = read("app/(connected)/gouvernance/page.tsx");
const panel = read("components/ReceivedJourneyInvitations.tsx");
const modelGap = read("docs/journey-external-guest-access.md");

test("received invitations use inviteeUserId as their only recipient identity", () => {
  assert.match(repository, /where: \{ inviteeUserId: userId \}/);
  assert.doesNotMatch(repository, /displayName: userId|email: userId|metadata: userId/);
  assert.match(page, /id: params\.id, inviteeUserId: user\.id/);
  assert.match(service, /id: input\.invitationId, inviteeUserId: input\.userId/);
});

test("the recipient sees exactly their invitation and the sender does not", async () => {
  const invitation = {
    id: "invitation-a",
    inviteeUserId: "user-a",
    ownerId: "user-b",
    role: "PARTICIPANT",
    metadata: {},
    consent: { status: "PENDING" },
    relationTemplate: { name: "Parcours test", description: "Objectif test" },
    accessTokenExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
  };
  const { getReceivedJourneyInvitations } = loadTestModule<any>("lib/governed-journey-inbox.ts", {
    "@/lib/prisma": {
      prisma: {
        governedJourneyInvitation: { findMany: async ({ where }: any) => where.inviteeUserId === "user-a" ? [invitation] : [] },
        user: { findMany: async () => [{ id: "user-b", name: "Organisateur" }] },
      },
    },
    "@/lib/governed-invitation-role-label": { getGovernedInvitationRoleLabel: () => "Participant" },
    "@/lib/governed-journey-consent": { projectJourneyParticipationState: (item: any) => item.consent.status },
  });

  assert.equal((await getReceivedJourneyInvitations("user-a", new Date("2029-01-01T00:00:00.000Z"))).length, 1);
  assert.equal((await getReceivedJourneyInvitations("user-b", new Date("2029-01-01T00:00:00.000Z"))).length, 0);
});

test("Mes espaces exposes a compact invitation inbox with real states", () => {
  assert.match(governance, /getReceivedJourneyInvitations\(owner\.id\)/);
  assert.match(governance, /ReceivedJourneyInvitations/);
  assert.match(panel, /Invitations reçues/);
  assert.match(panel, /invitation.*à examiner/);
  assert.match(panel, /Invité par/);
  assert.doesNotMatch(panel, /ownerId|userId/);
  assert.match(panel, /Voir l’invitation/);
  for (const label of ["Invitation à laquelle répondre", "Participation acceptée", "Invitation refusée", "Invitation révoquée", "Invitation expirée"]) assert.match(repository, new RegExp(label));
});

test("the authenticated invitation page reuses Journey Consent transitions", () => {
  assert.match(actions, /decideReceivedJourneyInvitation/);
  assert.match(page, /acceptReceivedJourneyInvitation/);
  assert.match(page, /declineReceivedJourneyInvitation/);
  assert.match(page, /Accepter de participer/);
  assert.match(page, /Refuser/);
  assert.match(page, /Invité par/);
  assert.match(page, /select: \{ name: true \}/);
  assert.match(service, /status: "PENDING", version: invitation\.consent\.version/);
  assert.match(service, /type: input\.decision/);
});

test("self assignment stops at the documented model gap without directory workaround", () => {
  assert.match(modelGap, /MODEL_GAP/);
  assert.match(modelGap, /expectedRoleId/);
  assert.match(modelGap, /invitation explicite de son propre profil Annuaire reste possible/);
  assert.match(modelGap, /consentement `PENDING`/);
});
