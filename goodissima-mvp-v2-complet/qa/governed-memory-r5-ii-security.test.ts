import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const capabilities = readFileSync("lib/governed-journey/cockpit/memory-creation-capabilities.ts", "utf8");
const actions = readFileSync("lib/governed-memory/cockpit-creation-actions.ts", "utf8");

test("capabilities require an active owner-scoped root and expose global scope only", () => {
  assert.match(capabilities, /workspace: \{ ownerId: input\.requesterUserId, status: "ACTIVE" \}/);
  assert.match(capabilities, /if \(!extension\) return NONE/);
  assert.match(capabilities, /availableContexts: \[\]/);
  for (const permission of ["PROPOSE_FACT", "RECORD_DECISION", "REGISTER_SOURCE"]) assert.match(capabilities, new RegExp(permission));
  assert.doesNotMatch(capabilities.slice(capabilities.indexOf("export type"), capabilities.indexOf("const NONE")), /workspaceId|userId|relationCaseId|governedJourneyId|role|permission:/i);
});

test("bounded actions expose no infrastructure detail or implicit automation", () => {
  assert.doesNotMatch(actions, /SQL|stack|OpenAI|Mistral|notification|invitation|communicationSession|validatedBy/i);
  assert.doesNotMatch(actions, /MESSAGE_EXCERPT|VALIDATED_SYNTHESIS/);
  assert.match(actions, /kind === "EXTERNAL_IMPORT" \? reference : null/);
});
