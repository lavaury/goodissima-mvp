import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const files = ["components/governed-memory/GovernedMemoryPage.tsx", "components/governed-memory/MemoryPresenters.tsx", "lib/governed-memory/client/api.ts", "lib/governed-memory/client/contracts.ts", "lib/governed-memory/client/query.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
const api = readFileSync("lib/governed-memory/client/api.ts", "utf8");
const presenters = readFileSync("components/governed-memory/MemoryPresenters.tsx", "utf8");

test("UI only calls MG-4 with GET and never transmits requester identity", () => {
  assert.match(api, /method: "GET"/); assert.match(api, /\/api\/internal\/relation-cases/); assert.doesNotMatch(api, /requesterUserId|method: "(POST|PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(files, /@\/lib\/prisma|@prisma\/client|persistence\/|governed-memory\/read\/service|governed-memory\/read\/repository/);
});

test("fully hidden items are absent and existence-disclosed items stay generic", () => {
  assert.match(presenters, /items\.some\(\(item\) => item\.level === "EXISTENCE_DISCLOSED"\)/);
  assert.doesNotMatch(presenters, /disclosedId|reasonCode|FULLY_HIDDEN/);
  assert.match(presenters, /Un ou plusieurs éléments existent/);
});

test("UI persists no memory, logs no payload and injects no HTML", () => {
  assert.doesNotMatch(files, /localStorage|sessionStorage|indexedDB|serviceWorker|console\.|dangerouslySetInnerHTML|data-[a-z-]+=/);
  assert.doesNotMatch(files, /OpenAI|Mistral|embedding|vector|prompt|chatbot/i);
});

test("journey provenance exposes no identity, reason, link or action", () => {
  const provenance = presenters.slice(presenters.indexOf("export function MemorySourceCard"), presenters.indexOf("export function MemoryFactCard"));
  assert.match(provenance, /Provenance du parcours/);
  assert.doesNotMatch(provenance, /reason|actorUserId|authorityUserId|governedJourneyId|governedJourneyEventId|<Link|href=|onClick=.*provenance/);
  assert.doesNotMatch(readFileSync("components/governed-memory/GovernedMemoryPage.tsx", "utf8"), /Provenance du parcours/);
});
