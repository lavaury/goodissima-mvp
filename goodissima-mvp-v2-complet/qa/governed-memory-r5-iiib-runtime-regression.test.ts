import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMemoryConcurrencyTokenForCapability } from "../lib/governed-memory/persistence/transition-idempotency.ts";

const service = readFileSync("lib/governed-journey/cockpit/memory-read-service.ts", "utf8");
const repository = readFileSync("lib/governed-journey/cockpit/memory-read-repository.ts", "utf8");
const envNames = ["GOVERNED_MEMORY_TOKEN_SECRET", "NEXTAUTH_SECRET", "AUTH_SECRET"] as const;
const input = { id: "internal-object", updatedAt: new Date("2026-08-20T12:00:00.000Z"), type: "FACT" as const, governedJourneyId: "internal-journey" };

function withoutTokenSecrets<T>(run: () => T) {
  const prior = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  try { return run(); } finally { for (const name of envNames) prior[name] === undefined ? delete process.env[name] : process.env[name] = prior[name]; }
}

test("a journey-only cockpit without roles never needs a concurrency secret", () => {
  withoutTokenSecrets(() => assert.equal(buildMemoryConcurrencyTokenForCapability(false, input), null));
  assert.match(service, /concurrencyToken\(canEstablish/);
  assert.match(service, /concurrencyToken\(canValidate/);
  assert.doesNotMatch(service, /concurrencyToken: buildMemoryConcurrencyToken\(/);
});

test("an active capability requires a configured secret and never falls back", () => {
  withoutTokenSecrets(() => assert.throws(() => buildMemoryConcurrencyTokenForCapability(true, input), /GOVERNED_MEMORY_TOKEN_SECRET_MISSING/));
  for (const name of envNames) withoutTokenSecrets(() => { process.env[name] = "deterministic-test-secret-only"; const token = buildMemoryConcurrencyTokenForCapability(true, input); assert.match(token ?? "", /^[^.]+\.[^.]+$/); });
});

test("nullable qualification scopes and empty result sets remain supported", () => {
  assert.match(repository, /governedMemoryValidation\.findMany/); assert.match(repository, /governedMemoryDispute\.findMany/);
  assert.match(repository, /governedJourneyId: input\.governedJourneyId/);
  assert.match(repository, /\.\.\.\(input\.relationCaseId \? \[\{ relationCaseId: input\.relationCaseId \}\] : \[\]\)/);
  assert.match(service, /latestValidations\(rows\.validations\)/); assert.match(service, /latestDisputes\(rows\.disputes\)/);
  assert.match(service, /CONCURRENCY_TOKEN_GENERATION_FAILED/);
  assert.doesNotMatch(service, /console\.(?:error|log)\([^\n]*(?:tokenSecret|concurrencyToken|requesterUserId)/);
});
