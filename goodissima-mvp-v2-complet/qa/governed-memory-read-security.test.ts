import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("lib/governed-memory/read/repository.ts", "utf8");
const service = readFileSync("lib/governed-memory/read/service.ts", "utf8");
const filter = readFileSync("lib/governed-memory/read/access-filter.ts", "utf8");

test("all repository collections are case scoped, bounded and stably ordered", () => {
  for (const model of ["Fact", "Decision", "Source", "Relation", "Validation", "Dispute", "Event", "AccessGrant", "RoleAssignment"]) assert.match(repository, new RegExp(`governedMemory${model}\\.findMany\\(\\{ where: \\{ relationCaseId`));
  assert.match(repository, /take: 1000/);
  assert.match(repository, /take: 501/);
  assert.match(repository, /orderBy: \[\{ recordedAt: "asc" \}, \{ id: "asc" \}\]/);
});

test("multi-query reads use repeatable-read transactions and contain no writes", () => {
  assert.match(repository, /isolationLevel: "RepeatableRead"/g);
  assert.doesNotMatch(repository, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/);
});

test("permissions and governed data share the same transactional reader", () => {
  assert.match(repository, /operation\(createTransactionalReader\(tx\)\)/);
  assert.match(repository, /resolveCurrentAccess/);
  assert.match(service, /repository\.runInSnapshot/);
  assert.match(service, /currentAccess\([^)]*reader\)/);
  assert.doesNotMatch(service, /resolveMemoryPermissions|governedMemoryRepository|persistence/);
});

test("revocations, expirations and targeted source grants are evaluated at the snapshot clock", () => {
  assert.match(repository, /revokedAt: \{ gt: now \}/);
  assert.match(repository, /effectiveUntil: \{ gt: now \}/);
  assert.match(repository, /resourceType === "SOURCE"/);
  assert.match(repository, /governedMemoryRoleAssignment\.findMany[\s\S]*revokedAt: \{ gt: now \}/);
  assert.match(service, /const operationNow = new Date\(now\)/);
  assert.doesNotMatch(service, /currentAccess\([^)]*new Date\(\)/);
});

test("period comparison resolves access once and builds both states in one snapshot", () => {
  const comparison = service.slice(service.indexOf("export async function compareMemoryPeriods"), service.indexOf("export async function explainDecision"));
  assert.equal((comparison.match(/repository\.runInSnapshot/g) ?? []).length, 1);
  assert.equal((comparison.match(/currentAccess\(/g) ?? []).length, 1);
  assert.match(comparison, /Promise\.all\(\[build\(from\), build\(to\)\]\)/);
  assert.doesNotMatch(comparison, /getMemoryStateAt\(/);
});

test("current VIEW_MEMORY is mandatory and inaccessible scope is not disclosed", () => {
  assert.match(service, /!resolved\?\.permissions\.has\("VIEW_MEMORY"\)/);
  assert.match(service, /GovernedMemoryReadError\("NOT_FOUND", "Memory not found\."\)/);
  assert.doesNotMatch(service, /Prisma|stack|DATABASE_URL/);
});

test("redaction prevents leaks through ids, titles, relations and timeline", () => {
  assert.match(filter, /disclosedId: existenceDisclosed \? source\.id : null/);
  assert.match(filter, /continue/);
  assert.match(service, /relations\.filter/);
  assert.match(readFileSync("lib/governed-memory/read/state-builder.ts", "utf8"), /row\.objectType !== "SOURCE" \|\| sourceFilter\.visibleIds\.has\(row\.objectId\)/);
});

test("MG-3 contains no AI, embedding, API, UI or business mutation", () => {
  const all = [repository, service, filter, readFileSync("lib/governed-memory/read/state-builder.ts", "utf8"), readFileSync("lib/governed-memory/read/comparison.ts", "utf8")].join("\n");
  assert.doesNotMatch(all, /OpenAI|Mistral|embedding|vector|prompt|NextRequest|NextResponse|React|useState|generateSynthesis/i);
  assert.doesNotMatch(all, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/);
});
