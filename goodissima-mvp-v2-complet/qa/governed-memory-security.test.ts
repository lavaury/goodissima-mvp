import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const repository = read("lib/governed-memory/persistence/repository.ts");
const service = read("lib/governed-memory/persistence/service.ts");
const resolver = read("lib/governed-memory/persistence/permission-resolver.ts");

test("source objects are verified in the same case and never mutated", () => {
  for (const object of ["document", "message", "formSubmission", "relationEvent"]) assert.match(repository, new RegExp(`${object}\\.findFirst\\(\\{ where: \\{ id, caseId: relationCaseId`));
  assert.doesNotMatch(repository, /\.(document|message|formSubmission|relationEvent)\.(update|delete|create)/);
  assert.match(service, /Source object not found/);
});

test("private messages require permission, consent, bounded excerpt and restrictive visibility", () => {
  assert.match(service, /canPromotePrivateSource/);
  assert.match(service, /findSourceObjectInCase\(input\.relationCaseId, "Message", input\.messageId\)/);
  assert.match(service, /AUTHOR_PROMOTED_OWN_MESSAGE/);
  assert.match(service, /PRIVATE_TO_AUTHOR/);
  assert.match(service, /required\(input\.excerpt, "excerpt", 2_000\)/);
  assert.doesNotMatch(service, /message\.body/);
});

test("permission resolution has no permissive fallback or expired grant reuse", () => {
  assert.match(repository, /effectiveFrom: \{ lte: at \}/);
  assert.match(repository, /revokedAt: \{ gt: at \}/);
  assert.match(resolver, /if \(!memoryCase \|\| memoryCase\.governanceStatus === "BLOCKED"\) return null/);
  assert.match(resolver, /sourceResourceIds/);
  assert.match(resolver, /return !input\.restricted/);
  assert.doesNotMatch(resolver, /return true;\s*$/m);
});

test("cross-case or inaccessible operations become stable not-found errors", () => {
  assert.match(service, /throw new GovernedMemoryServiceError\("NOT_FOUND", "Memory scope not found\."\)/);
  assert.match(repository, /id_relationCaseId: \{ id, relationCaseId \}/);
  assert.doesNotMatch(service, /DATABASE_URL|PrismaClientKnownRequestError|stack/);
});

test("MG-2 introduces no API, UI, AI, synthesis or embedding dependency", () => {
  const combined = `${repository}\n${service}\n${resolver}`;
  assert.doesNotMatch(combined, /OpenAI|Mistral|embedding|vector|prompt|chat completion/i);
  assert.doesNotMatch(combined, /GovernedMemorySynthesis|generateSynthesis/);
  assert.doesNotMatch(combined, /NextRequest|NextResponse|React|useState|router/);
});

test("append-only objects expose no update or delete repository", () => {
  assert.doesNotMatch(repository, /governedMemoryValidation\.(update|updateMany|delete|deleteMany)/);
  assert.doesNotMatch(repository, /governedMemoryEvent\.(update|updateMany|delete|deleteMany)/);
  assert.doesNotMatch(repository, /governedMemory(Relation|Fact|Decision|Source|AccessGrant|Dispute|RoleAssignment)?\.(delete|deleteMany)/);
});

test("revocation services always write time and actor together", () => {
  assert.match(repository, /data: \{ revokedAt: now, revokedByUserId: actorUserId \}/);
  assert.match(repository, /revokeMemoryRole[\s\S]*?data: \{ revokedAt: now, revokedByUserId: actorUserId \}/);
  assert.doesNotMatch(repository, /data: \{ revokedByUserId: actorUserId \}/);
});
