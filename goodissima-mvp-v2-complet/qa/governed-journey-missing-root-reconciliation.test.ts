import assert from "node:assert/strict";
import test from "node:test";
import { assessMissingGovernedJourneyRoot, reconcileMissingGovernedJourneyRoot, R2_REASON } from "../lib/governed-journey-missing-root-reconciliation.ts";

function fixture(options: { workspace?: boolean; omittedPlanWorkspace?: boolean; ambiguous?: boolean; badMarker?: boolean; badSnapshot?: boolean; existing?: "complete" | "incomplete"; fail?: "CREATED" | "M2" } = {}) {
  const operations: string[] = [];
  let root: Record<string, any> | null = options.existing ? {
    id: "existing", relationTemplateId: "template", formTemplateId: "form", createdFromTemplateVersionId: "version",
    authorityUserId: "owner", relationCaseId: null, status: "DRAFT",
    events: options.existing === "complete" ? [{ type: "CREATED", sequence: 1, fromStatus: null, toStatus: "DRAFT", actorUserId: "owner", authorityUserId: "owner", relationCaseId: null, reason: null }] : [],
  } : null;
  const version = { id: "version", templateId: "template", name: "Journey", description: "Goal", snapshot: {
    relationTemplate: { id: options.badSnapshot ? "wrong" : "template", key: "journey", name: "Journey" },
    formTemplate: { id: "form", key: "form-key", name: "Journey" },
    metadata: { source: options.badMarker ? "OTHER" : "governance-v1-minimal-create", snapshotVersion: 2,
      createdById: "owner", workspaceId: options.workspace ? "workspace" : null,
      creationPlan: { title: "Journey", createdBy: "owner", workspaceId: options.omittedPlanWorkspace ? null : options.workspace ? "workspace" : null } },
  } };
  const template = () => ({
    id: "template", key: "journey", name: "Journey", description: "Goal",
    workspaceId: options.workspace ? "workspace" : null,
    workspace: options.workspace ? { ownerId: "owner" } : null,
    versions: [version], formTemplates: [{ id: "form", key: "form-key", name: "Journey", description: "Goal", relationTemplateId: "template" }],
    governedJourney: root ? [root] : [], generations: options.ambiguous ? [] : [{ createdById: "owner" }],
    relationCases: [], links: [], governedJourneyCreationRequest: null,
  });
  let pendingRoot: Record<string, any> | null = null;
  let pendingEvent: Record<string, any> | null = null;
  const tx = {
    relationTemplate: { findUnique: async () => template(), findUniqueOrThrow: async () => ({ name: "Journey" }) },
    governedJourney: { create: async ({ data }: { data: Record<string, any> }) => { operations.push("ROOT"); pendingRoot = { ...data }; return data; } },
    governedJourneyEvent: { create: async ({ data }: { data: Record<string, any> }) => {
      operations.push("CREATED"); if (options.fail === "CREATED") throw new Error("CREATED failed"); pendingEvent = { ...data }; return data;
    } },
    $executeRawUnsafe: async (sql: string) => { operations.push(sql); if (options.fail === "M2") throw new Error("M2 failed"); return 0; },
  };
  const client = {
    relationTemplate: tx.relationTemplate,
    governedJourney: { findUnique: async () => root, create: tx.governedJourney.create },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const result = await run(tx);
      if (pendingRoot && pendingEvent) root = { ...pendingRoot, events: [pendingEvent] };
      return result;
    },
  };
  return { client, operations, getRoot: () => root };
}

test("strict historical candidate requires snapshot coherence and independent authority evidence", async () => {
  for (const workspace of [false, true]) {
    const { client } = fixture({ workspace });
    const assessment = await assessMissingGovernedJourneyRoot(client as never, "template");
    assert.equal(assessment.status, "AUTHORITY_PROVEN");
    if (assessment.status === "AUTHORITY_PROVEN") assert.equal(assessment.relationCaseId, null);
  }
  // Older plans can carry a planning-only Workspace reference; persisted metadata and owner are authoritative.
  assert.equal((await assessMissingGovernedJourneyRoot(fixture({ workspace: true, omittedPlanWorkspace: true }).client as never, "template")).status, "AUTHORITY_PROVEN");
  assert.equal((await assessMissingGovernedJourneyRoot(fixture({ ambiguous: true }).client as never, "template")).status, "AUTHORITY_AMBIGUOUS");
  assert.equal((await assessMissingGovernedJourneyRoot(fixture({ badMarker: true }).client as never, "template")).status, "NOT_CANDIDATE");
  assert.equal((await assessMissingGovernedJourneyRoot(fixture({ badSnapshot: true }).client as never, "template")).status, "NOT_CANDIDATE");
});

test("R2 creates only root and CREATED, checks M2 last, and verifies independent read-back", async () => {
  const { client, operations, getRoot } = fixture({ workspace: true });
  const result = await reconcileMissingGovernedJourneyRoot(client as never, "template");
  assert.equal(result.status, "RECONCILED");
  assert.deepEqual(operations, ["ROOT", "CREATED", 'SET CONSTRAINTS "GovernedJourney_created_at_commit" IMMEDIATE']);
  assert.equal(getRoot()?.events.length, 1);
  assert.equal(getRoot()?.events[0].reason, R2_REASON);
  assert.equal(getRoot()?.events[0].actorUserId, "owner");
  assert.equal(getRoot()?.events[0].relationCaseId, null);
  assert.ok(Math.abs(new Date(getRoot()?.events[0].occurredAt).getTime() - Date.now()) < 10_000);
});

test("repeat is read-only even after later lifecycle events; ambiguous authority is skipped; incomplete root stops", async () => {
  const complete = fixture({ existing: "complete" });
  assert.equal((await reconcileMissingGovernedJourneyRoot(complete.client as never, "template")).status, "ALREADY_RECONCILED");
  assert.deepEqual(complete.operations, []);
  const progressed = fixture({ existing: "complete" });
  progressed.getRoot()!.status = "ACTIVE";
  progressed.getRoot()!.events.push({ type: "STARTED", sequence: 2, fromStatus: "DRAFT", toStatus: "ACTIVE", actorUserId: "owner", authorityUserId: "owner", relationCaseId: null });
  assert.equal((await reconcileMissingGovernedJourneyRoot(progressed.client as never, "template")).status, "ALREADY_RECONCILED");
  assert.deepEqual(progressed.operations, []);
  const ambiguous = fixture({ ambiguous: true });
  assert.equal((await reconcileMissingGovernedJourneyRoot(ambiguous.client as never, "template")).status, "SKIPPED_AUTHORITY_AMBIGUOUS");
  assert.deepEqual(ambiguous.operations, []);
  await assert.rejects(reconcileMissingGovernedJourneyRoot(fixture({ existing: "incomplete" }).client as never, "template"), /R2 stopped/);
});

test("CREATED or M2 failure rejects and rolls the entire transaction back", async () => {
  for (const fail of ["CREATED", "M2"] as const) {
    const state = fixture({ fail });
    await assert.rejects(reconcileMissingGovernedJourneyRoot(state.client as never, "template"));
    assert.equal(state.getRoot(), null);
  }
});
