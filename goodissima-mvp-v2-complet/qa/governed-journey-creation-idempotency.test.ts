import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildGovernedJourneyCreationFingerprint,
  buildWorkspaceScopeKey,
  evaluateCompletedCreationRequest,
  fingerprintsEqual,
  normalizeCreationRequestKey,
} from "../lib/governed-journey/creation-idempotency.ts";
import {
  completeCreationRequest,
  isCreationRequestUniqueConflict,
  isPrismaSerializationConflict,
  isPrismaUniqueConflict,
  reserveCreationRequest,
} from "../lib/governed-journey/creation-request-repository.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const action = read("lib/governance-journey-actions.ts");
const repository = read("lib/governed-journey/creation-request-repository.ts");
const manualUi = read("app/gouvernance/nouveau/page.tsx");
const assistantUi = read("app/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");

const fingerprintInput = {
  requesterUserId: "user-a",
  workspaceScopeKey: "id:workspace-a",
  name: "Parcours A",
  initialNeed: "Besoin suffisamment detaille",
  objective: "Objectif A",
  workspaceCategory: "PROJECT" as const,
  participants: ["Alice", "Bob"],
  documents: ["Contrat", "Rapport"],
  confidentialityRules: ["Equipe uniquement"],
  firstActions: ["Relire", "Valider"],
  aiProvenance: null,
};

test("request keys are required canonical UUID v4 values and normalized to lowercase", () => {
  assert.equal(normalizeCreationRequestKey(" 550E8400-E29B-41D4-A716-446655440000 "), "550e8400-e29b-41d4-a716-446655440000");
  for (const invalid of [null, "", "550e8400-e29b-11d4-a716-446655440000", "550e8400-e29b-41d4-c716-446655440000", "not-a-uuid"]) {
    assert.equal(normalizeCreationRequestKey(invalid), null);
  }
  assert.match(action, /if \(!requestKey\) invalidInput\(\)/);
  assert.match(action, /"requestFingerprint"/);
});

test("the canonical fingerprint is deterministic, owner-scoped and order-sensitive", () => {
  const fingerprint = buildGovernedJourneyCreationFingerprint(fingerprintInput);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(buildGovernedJourneyCreationFingerprint({ ...fingerprintInput }), fingerprint);
  assert.notEqual(buildGovernedJourneyCreationFingerprint({ ...fingerprintInput, name: "Parcours B" }), fingerprint);
  assert.notEqual(buildGovernedJourneyCreationFingerprint({ ...fingerprintInput, requesterUserId: "user-b" }), fingerprint);
  assert.notEqual(buildGovernedJourneyCreationFingerprint({ ...fingerprintInput, participants: ["Bob", "Alice"] }), fingerprint);
  assert.notEqual(buildGovernedJourneyCreationFingerprint({ ...fingerprintInput, workspaceScopeKey: "slug:workspace-a" }), fingerprint);
  assert.equal(fingerprintsEqual(fingerprint, fingerprint), true);
  assert.equal(fingerprintsEqual(fingerprint, "0".repeat(64)), false);
  assert.equal(fingerprintsEqual(fingerprint, "short"), false);
});

test("Workspace scopes distinguish exact ids from canonical slugs", () => {
  assert.equal(buildWorkspaceScopeKey({ workspaceId: "workspace-a", workspaceSlug: "ignored" }), "id:workspace-a");
  assert.equal(buildWorkspaceScopeKey({ workspaceId: "", workspaceSlug: "nouveau-workspace" }), "slug:nouveau-workspace");
  assert.throws(() => buildWorkspaceScopeKey({ workspaceId: "", workspaceSlug: "x".repeat(257) }), /INVALID_WORKSPACE_SCOPE/);
});

test("completed recovery validates owner, active Workspace, fingerprint and every structural relation", () => {
  const requestFingerprint = buildGovernedJourneyCreationFingerprint(fingerprintInput);
  const expected = {
    requesterUserId: "user-a",
    requestKey: "550e8400-e29b-41d4-a716-446655440000",
    requestFingerprint,
    workspaceScopeKey: "id:workspace-a",
  };
  const request = {
    ...expected,
    workspaceId: "workspace-a",
    relationTemplateId: "rt-a",
    formTemplateId: "ft-a",
    governedJourneyId: "gj-a",
    completedAt: new Date("2026-08-10T12:00:00.000Z"),
    workspace: { id: "workspace-a", ownerId: "user-a", status: "ACTIVE" },
    relationTemplate: { id: "rt-a", workspaceId: "workspace-a" },
    formTemplate: { id: "ft-a", relationTemplateId: "rt-a" },
    governedJourney: { id: "gj-a", relationTemplateId: "rt-a", formTemplateId: "ft-a" },
  };
  assert.deepEqual(evaluateCompletedCreationRequest(request, expected), { kind: "SUCCESS", formTemplateId: "ft-a" });
  assert.deepEqual(evaluateCompletedCreationRequest({ ...request, requestFingerprint: "0".repeat(64) }, expected), { kind: "CONFLICT" });
  assert.deepEqual(evaluateCompletedCreationRequest({ ...request, workspaceScopeKey: "slug:workspace-a" }, expected), { kind: "CONFLICT" });
  assert.deepEqual(evaluateCompletedCreationRequest({ ...request, workspace: { ...request.workspace, status: "ARCHIVED" } }, expected), { kind: "NOT_FOUND" });
  assert.deepEqual(evaluateCompletedCreationRequest({ ...request, workspace: { ...request.workspace, ownerId: "user-b" } }, expected), { kind: "NOT_FOUND" });
  assert.deepEqual(evaluateCompletedCreationRequest({ ...request, formTemplate: { ...request.formTemplate, relationTemplateId: "rt-b" } }, expected), { kind: "CORRUPT" });
  assert.deepEqual(evaluateCompletedCreationRequest({ ...request, completedAt: null }, expected), { kind: "CORRUPT" });
});

test("reservation and completion are each one all-or-nothing repository write", async () => {
  const calls: unknown[] = [];
  const tx = {
    governedJourneyCreationRequest: {
      create: async (args: unknown) => { calls.push(["create", args]); return { id: "request-a" }; },
      updateMany: async (args: unknown) => { calls.push(["updateMany", args]); return { count: 1 }; },
    },
  };
  await reserveCreationRequest({
    tx: tx as never,
    requesterUserId: "user-a",
    requestKey: "550e8400-e29b-41d4-a716-446655440000",
    requestFingerprint: "a".repeat(64),
    workspaceScopeKey: "id:workspace-a",
  });
  await completeCreationRequest({
    tx: tx as never,
    requesterUserId: "user-a",
    requestKey: "550e8400-e29b-41d4-a716-446655440000",
    workspaceId: "workspace-a",
    relationTemplateId: "rt-a",
    formTemplateId: "ft-a",
    governedJourneyId: "gj-a",
    completedAt: new Date("2026-08-10T12:00:00.000Z"),
  });
  assert.equal(calls.length, 2);
  assert.deepEqual((calls[0] as [string, { data: Record<string, unknown> }])[1].data, {
    requesterUserId: "user-a", requestKey: "550e8400-e29b-41d4-a716-446655440000",
    requestFingerprint: "a".repeat(64), workspaceScopeKey: "id:workspace-a",
    workspaceId: null, relationTemplateId: null, formTemplateId: null, governedJourneyId: null, completedAt: null,
  });
  const completion = (calls[1] as [string, { data: Record<string, unknown> }])[1].data;
  for (const field of ["workspaceId", "relationTemplateId", "formTemplateId", "governedJourneyId", "completedAt"]) assert.ok(completion[field]);
});

test("Prisma conflict classification distinguishes reservation uniqueness and serialization", () => {
  const reservationConflict = { code: "P2002", meta: { target: ["requesterUserId", "requestKey"] } };
  assert.equal(isCreationRequestUniqueConflict(reservationConflict), true);
  assert.equal(isPrismaUniqueConflict(reservationConflict), true);
  assert.equal(isCreationRequestUniqueConflict({ code: "P2002", meta: { target: ["key"] } }), false);
  assert.equal(isPrismaSerializationConflict({ code: "P2034" }), true);
  assert.equal(isPrismaSerializationConflict({ code: "P2002" }), false);
});

test("the action reserves, creates, completes and retries at most twice in Serializable transactions", () => {
  const reservation = action.indexOf("reserveCreationRequest");
  const workspace = action.indexOf("tx.workspace", reservation);
  const extension = action.indexOf("createGovernedJourneyExtensionInTransaction", workspace);
  const completion = action.indexOf("completeCreationRequest", extension);
  assert.ok(reservation >= 0 && workspace > reservation && extension > workspace && completion > extension);
  assert.match(action, /for \(let attempt = 0; attempt < 2/);
  assert.match(action, /isolationLevel: "Serializable"/);
  assert.match(action, /isCreationRequestUniqueConflict/);
  assert.match(action, /isPrismaSerializationConflict/);
  assert.match(action, /20 \+ Math\.floor\(Math\.random\(\) \* 31\)/);
  assert.doesNotMatch(action, /while\s*\(/);
});

test("R2-C2 keeps UI, cockpit-facing redirect and prohibited side effects unchanged", () => {
  assert.match(`${manualUi}\n${assistantUi}`, /requestKey/);
  assert.doesNotMatch(`${manualUi}\n${assistantUi}`, /requestFingerprint|GovernedJourneyCreationRequest/);
  assert.match(action, /redirect\(`\/gouvernance\/parcours\/\$\{formTemplateId\}\/pilotage`\)/);
  assert.equal((repository.match(/governedJourneyCreationRequest\.create/g) ?? []).length, 1);
  assert.equal((repository.match(/governedJourneyCreationRequest\.updateMany/g) ?? []).length, 1);
  assert.doesNotMatch(`${action}\n${repository}`, /governedJourneyEvent\.create|governedJourneyRelationCase\.create|governedMemory|invitation\.create|notification\.create|communicationSession\.create/i);
});
