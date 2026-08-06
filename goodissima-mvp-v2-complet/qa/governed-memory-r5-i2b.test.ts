import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMemoryCreationFingerprint, buildPublicMemoryKey, memoryFingerprintsEqual, normalizeMemoryCreationRequestKey } from "../lib/governed-memory/persistence/creation-idempotency.ts";

const read = (path: string) => readFileSync(path, "utf8");
const service = read("lib/governed-memory/persistence/service.ts");
const commands = read("lib/governed-memory/persistence/journey-creation-service.ts");
const requests = read("lib/governed-memory/persistence/creation-request-repository.ts");
const r4Repository = read("lib/governed-journey/cockpit/memory-read-repository.ts");
const r4Service = read("lib/governed-journey/cockpit/memory-read-service.ts");

test("ordinary historical source registration requires REGISTER_SOURCE only", () => {
  const block = service.slice(service.indexOf("export async function registerMemorySource"), service.indexOf("export async function promotePrivateMessageExcerpt"));
  assert.match(block, /permissions\.has\("REGISTER_SOURCE"\)/);
  assert.doesNotMatch(block, /permissions\.has\("VIEW_SOURCES"\)|PROMOTE_PRIVATE_SOURCE/);
  assert.match(service.slice(service.indexOf("export async function promotePrivateMessageExcerpt")), /canPromotePrivateSource/);
});

test("request keys and fingerprints are canonical, strict and opaque", () => {
  assert.equal(normalizeMemoryCreationRequestKey(" 550E8400-E29B-41D4-A716-446655440000 "), "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(normalizeMemoryCreationRequestKey("550e8400-e29b-11d4-a716-446655440000"), null);
  const input = { category: "FACT", requesterUserId: "owner", formTemplateId: "form", relationTemplateId: "template", governedJourneyId: "journey", relationCaseId: null,
    business: { statement: "Fait", evidenceLevel: "DECLARED", effectiveFrom: "2026-08-01T00:00:00.000Z", effectiveUntil: null, provenance: null } } as const;
  const first = buildMemoryCreationFingerprint(input); const second = buildMemoryCreationFingerprint({ ...input });
  assert.equal(first, second); assert.equal(memoryFingerprintsEqual(first, second), true); assert.match(first, /^[0-9a-f]{64}$/);
  const publicKey = buildPublicMemoryKey("FACT", "internal-id"); assert.match(publicKey, /^[0-9a-f]{64}$/); assert.doesNotMatch(publicKey, /internal-id/);
});

test("three commands resolve owner-scoped roots and optional explicit contexts", () => {
  for (const name of ["proposeJourneyFact", "createJourneyDecisionDraft", "registerJourneySource"]) assert.match(commands, new RegExp(`export function ${name}`));
  assert.match(commands, /formTemplate\.findFirst/);
  assert.match(commands, /workspace: \{ ownerId: input\.requesterUserId, status: "ACTIVE" \}/);
  assert.match(commands, /governedJourneyRelationCase\.findUnique/);
  assert.match(commands, /governedJourneyId_relationCaseId/);
  assert.doesNotMatch(commands, /GovernedJourneyRelationCase.*create|governedJourneyRelationCase\.create/);
  for (const forbidden of ["workspaceId", "ownerId", "authorityUserId", "eventId", "actorType", "status"]) {
    const common = commands.slice(commands.indexOf("type CommonInput"), commands.indexOf("const required"));
    assert.doesNotMatch(common, new RegExp(`${forbidden}\\??:`));
  }
});

test("commands create exact initial states and human events in one Serializable protocol", () => {
  for (const pair of [["PROPOSED", "FACT_PROPOSED"], ["DRAFT", "DECISION_RECORDED"], ["ACTIVE", "SOURCE_REGISTERED"]]) for (const token of pair) assert.match(commands, new RegExp(`"${token}"`));
  assert.equal((commands.match(/actorType: "HUMAN"/g) ?? []).length, 3);
  assert.match(commands, /isolationLevel: "Serializable"/);
  assert.ok(commands.indexOf("createMemoryCreationReservation") < commands.indexOf("const checked = await resolveAuthority"));
  assert.ok(commands.indexOf("completeMemoryCreation({ tx") > commands.indexOf("const id = await create"));
  assert.doesNotMatch(commands, /governedJourneyEvent\.create|validatedByUserId|OpenAI|Mistral|notification\.|invitation\.|communicationSession\./i);
});

test("idempotence lookup, completion and retry remain bounded", () => {
  assert.match(requests, /requesterUserId_requestKey: \{ requesterUserId: input\.requesterUserId, requestKey: input\.requestKey \}/);
  const lookup = requests.slice(requests.indexOf("findCompletedMemoryCreationRequest"), requests.indexOf("createMemoryCreationReservation"));
  assert.doesNotMatch(lookup, /requestFingerprint|relationTemplateId|governedJourneyId|relationCaseId/);
  assert.match(requests, /updateMany/); assert.match(requests, /completedAt: null/);
  assert.match(commands, /attempt < 2/); assert.match(commands, /20 \+ Math\.floor\(Math\.random\(\) \* 31\)/);
  assert.match(commands, /isMemoryRequestKeyConflict/); assert.match(commands, /isMemoryResultConflict/); assert.match(commands, /isMemorySerializationConflict/);
});

test("R4 directly loads journey objects, preserves relations and deduplicates in queries", () => {
  for (const model of ["governedMemoryFact", "governedMemoryDecision", "governedMemorySource"]) assert.match(r4Repository, new RegExp(`${model}\\.findMany`));
  assert.match(r4Repository, /governedJourneyId: input\.governedJourneyId/);
  assert.match(r4Repository, /governedMemoryRelation\.findMany/);
  assert.match(r4Repository, /OR: \[\{ governedJourneyId: input\.governedJourneyId \}/);
  assert.doesNotMatch(r4Repository, /governedMemoryEvent\.find|include:/);
  assert.doesNotMatch(r4Service, /if \(!extension\.relationCaseId\) return/);
});

test("R5-I2b adds no schema migration, UI action or parallel route", () => {
  const page = read("app/gouvernance/parcours/[id]/pilotage/page.tsx"); const component = read("components/governed-journey/GovernedMemoryCockpitSection.tsx");
  assert.doesNotMatch(`${page}\n${component}`, /proposeJourneyFact|createJourneyDecisionDraft|registerJourneySource/);
  assert.doesNotMatch(component, /<form|<button|action=|onClick/);
  assert.doesNotMatch(commands, /revalidatePath|redirect|Server Action|"use server"/);
});
