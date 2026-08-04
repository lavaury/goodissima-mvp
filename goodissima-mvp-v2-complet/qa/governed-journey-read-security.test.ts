import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GJ-4 owner and case scopes are explicit and sensitive fields are not selected", async () => {
  const repository = await readFile(new URL("../lib/governed-journey/read/repository.ts", import.meta.url), "utf8");
  const types = await readFile(new URL("../lib/governed-journey/read/types.ts", import.meta.url), "utf8");
  assert.match(repository, /ownerId: input\.requesterUserId/);
  assert.match(repository, /id: input\.journeyId, relationCaseId: input\.relationCaseId/);
  assert.match(repository, /governedJourneyId: input\.journeyId, relationCaseId: input\.relationCaseId/);
  for (const forbidden of ["version", "currentStepKey", "authorityUserId", "actorUserId", "reason", "formTemplateId", "relationTemplateId"]) {
    assert.doesNotMatch(types, new RegExp(`\\b${forbidden}\\b`));
  }
  assert.doesNotMatch(repository, /\.(create|update|delete|upsert)\s*\(/);
});
