import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCockpitPublicMemoryKey, buildTransitionFingerprint, fingerprintsEqual, normalizeTransitionRequestKey } from "../lib/governed-memory/persistence/transition-idempotency.ts";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260814120000_add_governed_memory_transition_requests/migration.sql");
const service = read("lib/governed-memory/persistence/journey-transition-service.ts");
const readService = read("lib/governed-journey/cockpit/memory-read-service.ts");

test("transition request keys and fingerprints are canonical and durable", () => {
  assert.equal(normalizeTransitionRequestKey(" 550E8400-E29B-41D4-A716-446655440000 "), "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(normalizeTransitionRequestKey("550e8400-e29b-11d4-a716-446655440000"), null);
  const left = buildTransitionFingerprint({ transitionType: "DISPUTE_FACT", reason: "motif" });
  assert.equal(left.length, 64); assert.equal(fingerprintsEqual(left, left), true);
  assert.equal(buildCockpitPublicMemoryKey("FACT", "internal").length, 64);
});

test("the dedicated request model has strict scope, result, uniqueness and RLS constraints", () => {
  assert.match(schema, /model GovernedMemoryTransitionRequest/);
  assert.match(schema, /@@unique\(\[requesterUserId, requestKey\]\)/);
  assert.match(migration, /request_key_check[\s\S]*fingerprint_check[\s\S]*shape_check[\s\S]*completion_check/);
  assert.match(migration, /FOREIGN KEY \("governedJourneyId", "relationTemplateId"\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY|INSERT INTO|UPDATE "GovernedMemory|GovernedMemoryCreationRequest/);
});

test("role administration is explicit, owner-scoped, reversible and restricted", () => {
  assert.match(service, /export function grantJourneyMemoryRole/);
  assert.match(service, /export function revokeJourneyMemoryRole/);
  assert.match(service, /workspace: \{ ownerId: input\.requesterUserId, status: "ACTIVE" \}/);
  assert.match(service, /allowedRoles[\s\S]*MEMORY_STEWARD[\s\S]*MEMORY_DELEGATE/);
  assert.match(service, /data: \{ revokedAt: null, grantedByUserId/);
  assert.match(service, /data: \{ revokedAt: now \}/);
  assert.doesNotMatch(service, /authorityUserId|invitation|communicationSession|RelationCase.ownerId/);
});

test("three transitions are Serializable, conditional, idempotent and human-audited", () => {
  for (const command of ["establishJourneyFact", "disputeJourneyFact", "validateJourneyDecision"]) assert.match(service, new RegExp(`export function ${command}`));
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.match(service, /P2002/); assert.match(service, /P2034/); assert.match(service, /attempt < 2/);
  assert.match(service, /governedMemoryFact\.updateMany/); assert.match(service, /governedMemoryDecision\.updateMany/);
  assert.match(service, /decision: "APPROVED"/); assert.match(service, /status: "OPEN"/);
  assert.match(service, /type: "DISPUTE_OPENED"[\s\S]*actorType: "HUMAN"/);
  assert.doesNotMatch(service, /status: "DISPUTED"|SOURCE_ARCHIVED|notification|OpenAI|Mistral/);
});

test("R4 receives safe capabilities and opaque concurrency tokens without UI actions", () => {
  assert.match(readService, /canEstablish/); assert.match(readService, /canDispute/); assert.match(readService, /canValidate/);
  assert.match(readService, /buildMemoryConcurrencyToken/);
  const ui = `${read("app/gouvernance/parcours/[id]/pilotage/page.tsx")}\n${read("components/governed-journey/GovernedMemoryCockpitSection.tsx")}`;
  assert.doesNotMatch(ui, /establishJourneyFact|disputeJourneyFact|validateJourneyDecision|grantJourneyMemoryRole|revokeJourneyMemoryRole/);
});
