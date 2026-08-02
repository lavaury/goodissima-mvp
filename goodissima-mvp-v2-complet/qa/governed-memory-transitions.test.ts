import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectStateAt, wasKnownAt } from "../lib/governed-memory/temporal.ts";

const repository = readFileSync("lib/governed-memory/persistence/repository.ts", "utf8");
const service = readFileSync("lib/governed-memory/persistence/service.ts", "utf8");

test("retroactive information is effective historically but unknown before recording", () => {
  const item = { recordedAt: "2026-04-01T00:00:00.000Z", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: null };
  assert.equal(wasKnownAt(item.recordedAt, "2026-02-01T00:00:00.000Z"), false);
  assert.deepEqual(selectStateAt([item], "2026-02-01T00:00:00.000Z"), []);
  assert.equal(selectStateAt([item], "2026-05-01T00:00:00.000Z").length, 1);
});

test("validated decisions are immutable and evolve through successors", () => {
  assert.match(repository, /updateDraftDecisionConditionally[\s\S]*?status: "DRAFT"/);
  assert.match(repository, /validateDecisionConditionally[\s\S]*?status: "DRAFT"/);
  assert.match(repository, /createSuccessorDecision/);
  assert.match(repository, /type: input\.type, sourceType: "DECISION"/);
  assert.doesNotMatch(repository, /governedMemoryDecision\.update\(/);
});

test("fact supersession creates a successor before conditionally closing the prior fact", () => {
  const section = repository.slice(repository.indexOf("supersedeFactTransactionally"), repository.indexOf("listFactsKnownAt"));
  assert.ok(section.indexOf("governedMemoryFact.create") < section.indexOf("governedMemoryFact.updateMany"));
  assert.match(section, /status: "SUPERSEDED", supersededByFactId: successor\.id/);
  assert.match(section, /throw new Error\("GOVERNED_MEMORY_CONCURRENT_FACT_SUPERSESSION"\)/);
});

test("human validation and one event are written with each official transition", () => {
  const establish = repository.slice(repository.indexOf("establishFactConditionally"), repository.indexOf("supersedeFactTransactionally"));
  assert.equal((establish.match(/governedMemoryValidation\.create/g) ?? []).length, 1);
  assert.equal((establish.match(/FACT_ESTABLISHED/g) ?? []).length, 1);
  const validate = repository.slice(repository.indexOf("validateDecisionConditionally"), repository.indexOf("createSuccessorDecision"));
  assert.equal((validate.match(/governedMemoryValidation\.create/g) ?? []).length, 1);
  assert.equal((validate.match(/DECISION_VALIDATED/g) ?? []).length, 1);
});

test("optimistic conflicts never report success", () => {
  assert.match(service, /Only the current draft can be updated/);
  assert.match(service, /Decision changed or is immutable/);
  assert.match(service, /Grant changed or is already revoked/);
  assert.match(service, /Dispute changed or cannot be resolved/);
});

test("withdrawal is historical and limited to author or explicit authority", () => {
  assert.match(service, /const authorityMayWithdraw = canEstablishFact\(resolved\)/);
  assert.match(repository, /current\.raisedByUserId !== input\.actorUserId && !input\.authorityMayWithdraw/);
  assert.match(repository, /status: input\.status, resolvedAt: input\.now, resolvedByUserId: input\.actorUserId, resolution: input\.resolution/);
  assert.match(service, /required\(input\.resolution, "resolution", 4_000\)/);
});
