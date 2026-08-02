import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("lib/governed-memory/read/repository.ts", "utf8");
const service = readFileSync("lib/governed-memory/read/service.ts", "utf8");

test("decision explanation loads explicit relations in grouped queries", () => {
  assert.match(repository, /getDecisionTrace/);
  assert.match(repository, /sourceType: "DECISION", sourceId: decisionId/);
  assert.match(repository, /targetType: "DECISION", targetId: decisionId/);
  assert.match(repository, /Promise\.all/);
  assert.doesNotMatch(repository, /for \([^)]*\)[\s\S]{0,120}findMany/);
});

test("declared rationale, supports and later consequences remain distinct", () => {
  assert.match(service, /declaredRationale: decision\.declaredRationale/);
  assert.match(service, /explicitSupportingFacts: facts/);
  assert.match(service, /explicitSupportingSources: filtered\.visible/);
  assert.match(service, /laterConsequences: decision\.consequences/);
  assert.match(service, /CAUSALITY_NOT_ESTABLISHED/);
});

test("missing and redacted sources create limitations without becoming rationale", () => {
  assert.match(service, /SOURCE_NOT_LINKED/);
  assert.match(service, /SOURCE_REDACTED/);
  assert.doesNotMatch(service, /declaredRationale:\s*filtered/);
});
