import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("lib/governed-memory/http/auth.ts", "utf8");
const handlers = readFileSync("lib/governed-memory/http/handlers.ts", "utf8");

test("requester identity comes only from the authenticated server session", () => {
  assert.match(auth, /getCurrentUser\(\)/); assert.match(auth, /sessionUser\?\.email/); assert.match(auth, /email_confirmed_at/); assert.match(auth, /select: \{ id: true \}/); assert.match(auth, /requesterUserId: appUser\.id/);
  assert.doesNotMatch(auth, /upsert|create|update|delete/);
  assert.doesNotMatch(handlers, /query\(request\)\.get\("requesterUserId"\)|headers\.get\([^)]*requester/i);
});

test("every handler authenticates before parsing or calling MG-3", () => {
  assert.equal((handlers.match(/authenticateGovernedMemoryRequester\(\)/g) ?? []).length, 6);
  for (const service of ["getMemoryStateAt", "compareMemoryPeriods", "explainDecision", "reconstructAccessAt", "getMemoryTimeline", "getMemoryObjectTrace"]) assert.match(handlers, new RegExp(`${service}\\(\\{[^}]*requesterUserId`));
});
