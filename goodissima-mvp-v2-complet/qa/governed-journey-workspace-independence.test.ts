import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

const source = (path: string) => readFileSync(path, "utf8");

function authorityFixture(workspaceId: string | null, workspaceOwnerId = "owner") {
  const calls: unknown[] = [];
  const journey = {
    id: "journey", formTemplateId: "form", relationTemplateId: "template",
    authorityUserId: "owner", status: "DRAFT",
    relationTemplate: { workspaceId, workspace: workspaceId ? { ownerId: workspaceOwnerId } : null },
  };
  const client = { governedJourney: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
    calls.push(where);
    return where.formTemplateId === journey.formTemplateId && where.authorityUserId === journey.authorityUserId
      && (!where.id || where.id === journey.id) ? journey : null;
  } } };
  const { resolveOwnedGovernedJourney } = loadTestModule<{ resolveOwnedGovernedJourney: (client: unknown, input: Record<string, string>) => Promise<unknown> }>(
    "lib/governed-journey-authority.ts", { "@/lib/prisma": { prisma: client } },
  );
  return { client, calls, resolveOwnedGovernedJourney };
}

test("Journey authority resolves the same capabilities without and with Workspace", async () => {
  for (const workspaceId of [null, "workspace"]) {
    const fixture = authorityFixture(workspaceId);
    const scope = await fixture.resolveOwnedGovernedJourney(fixture.client, { formTemplateId: "form", authorityUserId: "owner", governedJourneyId: "journey" }) as { workspaceId: string | null; relationTemplateId: string };
    assert.equal(scope.relationTemplateId, "template");
    assert.equal(scope.workspaceId, workspaceId);
    assert.deepEqual(fixture.calls[0], { formTemplateId: "form", authorityUserId: "owner", id: "journey" });
  }
});

test("foreign owner, forged Journey ID and foreign Workspace never grant authority", async () => {
  const fixture = authorityFixture(null);
  assert.equal(await fixture.resolveOwnedGovernedJourney(fixture.client, { formTemplateId: "form", authorityUserId: "third-party" }), null);
  assert.equal(await fixture.resolveOwnedGovernedJourney(fixture.client, { formTemplateId: "form", authorityUserId: "owner", governedJourneyId: "other" }), null);
  const foreignWorkspace = authorityFixture("workspace", "third-party");
  assert.equal(await foreignWorkspace.resolveOwnedGovernedJourney(foreignWorkspace.client, { formTemplateId: "form", authorityUserId: "owner" }), null);
});

test("cockpit exposes participants, roles and meeting preparation without Workspace", () => {
  const cockpit = source("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  assert.doesNotMatch(cockpit, /Rattachez d’abord le parcours à un espace pour ajouter un participant|Un espace est nécessaire pour créer un accès invité/);
  assert.match(cockpit, /<GovernedJourneyAddParticipantPanel formTemplateId=\{formTemplate\.id\}/);
  assert.match(cockpit, /state === "UNASSIGNED" \? <GovernedJourneyAddParticipantPanel/);
  assert.match(cockpit, /<form action=\{prepareGovernanceMultiActorCommunicationAction\}/);
  assert.match(cockpit, /name="workspaceId" value=\{attachedWorkspaceId \?\? ""\}/);
});

test("mutation surfaces use Journey scope, never Workspace as the sole authority", () => {
  for (const path of [
    "app/api/gouvernance/invitations/route.ts",
    "lib/governed-journey-role-assignment-actions.ts",
    "lib/governance-communication-session-actions.ts",
    "lib/governed-meeting-participant-actions.ts",
    "lib/governed-meeting-participant-selection-actions.ts",
    "lib/governed-meeting-lifecycle-actions.ts",
    "lib/governed-meeting-history-actions.ts",
    "app/api/gouvernance/parcours/[id]/media/livekit-token/route.ts",
    "app/api/gouvernance/parcours/[id]/media/end/route.ts",
    "app/api/gouvernance/parcours/[id]/media/attendance/route.ts",
    "app/api/gouvernance/parcours/[id]/media/session-usage/route.ts",
  ]) {
    const text = source(path);
    assert.match(text, /resolveOwnedGovernedJourney/, path);
    assert.doesNotMatch(text, /relationTemplate: \{ workspace: \{ ownerId/, path);
  }
});

test("invitation, consent, explicit role and meeting RSVP retain distinct actions", () => {
  const invitation = source("app/api/gouvernance/invitations/route.ts");
  assert.match(invitation, /governedJourneyConsent\.create/);
  assert.match(invitation, /if \(expectedRoleId && governedJourney\) await tx\.governedJourneyExpectedRoleAssignment\.create/);
  const meeting = source("lib/governance-communication-session-actions.ts");
  assert.match(meeting, /workspaceId: scope\.workspaceId/);
  assert.match(meeting, /status: "PREPARED_NOT_STARTED"/);
  assert.match(meeting, /governedMeetingRsvp\.create\(\{ data: \{ meetingParticipantId: participant\.id, status: "PENDING"/);
  const selection = source("lib/governed-meeting-participant-selection-actions.ts");
  assert.match(selection, /createPendingMeetingRsvp/);
  assert.doesNotMatch(selection, /governedJourneyExpectedRoleAssignment\.create/);
});

test("meeting preparation persists under the Journey with or without Workspace", async () => {
  for (const workspaceId of [null, "workspace"]) {
    const writes: Record<string, unknown>[] = [];
    const db = {
      formTemplate: { findUnique: async () => ({ relationTemplate: { id: "template", versions: [{ snapshot: { metadata: {} } }] } }) },
      communicationSession: { findMany: async () => [] },
      governedJourneyInvitation: { findMany: async () => [] },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ communicationSession: { create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data); return { id: "meeting", rsvpRevision: 1 };
      } } }),
    };
    const actions = loadTestModule<{ prepareGovernanceMultiActorCommunicationAction: (data: FormData) => Promise<void> }>(
      "lib/governance-communication-session-actions.ts", {
        "next/cache": { revalidatePath: () => undefined },
        "next/navigation": { redirect: (href: string) => { throw new Error(`REDIRECT:${href}`); } },
        "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner" }) },
        "@/lib/prisma": { prisma: db },
        "@/lib/governed-journey-authority": { resolveOwnedGovernedJourney: async () => ({ id: "journey", relationTemplateId: "template", workspaceId, status: "DRAFT" }) },
      },
    );
    const data = new FormData();
    data.set("formTemplateId", "form"); data.set("workspaceId", workspaceId ?? "");
    data.set("channelType", "VIDEO_IP"); data.set("title", "Meeting");
    await assert.rejects(actions.prepareGovernanceMultiActorCommunicationAction(data), /REDIRECT:/);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].workspaceId, workspaceId);
    assert.equal(writes[0].relationTemplateId, "template");
    assert.equal(writes[0].status, "PREPARED_NOT_STARTED");
    assert.equal(writes[0].relationCaseId, null);
  }
});
