import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mapper = readFileSync("lib/governed-memory/http/error-mapper.ts", "utf8");
const response = readFileSync("lib/governed-memory/http/response-mapper.ts", "utf8");

test("error mapping is deterministic and non-disclosing", () => {
  assert.match(mapper, /GovernedMemoryHttpAuthError[\s\S]*status: 401/);
  assert.match(mapper, /INVALID_INPUT[\s\S]*status: 400/);
  assert.match(mapper, /NOT_FOUND" \|\| error\.code === "FORBIDDEN"/);
  assert.match(mapper, /status: 404, code: "NOT_FOUND"/);
  assert.match(mapper, /status: 500, code: "INTERNAL_ERROR"/);
  assert.doesNotMatch(`${mapper}\n${response}`, /error\.message|error\.stack|DATABASE_URL|PrismaClientKnownRequestError/);
});

test("responses expose only stable envelopes and technical request ids", () => {
  assert.match(response, /crypto\.randomUUID\(\)/); assert.match(response, /GovernedMemoryHttpSuccess/); assert.match(response, /GovernedMemoryHttpFailure/);
  assert.doesNotMatch(response, /console\.|JSON\.stringify/);
});
