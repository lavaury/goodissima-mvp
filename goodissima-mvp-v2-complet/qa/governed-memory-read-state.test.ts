import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMemoryState } from "../lib/governed-memory/read/state-builder.ts";

const access = { relationCaseId: "case-a", userId: "user-a", permissions: new Set(["VIEW_MEMORY", "VIEW_SOURCES"]), sourceResourceIds: new Set<string>(), isOwner: true } as never;
const truncated = { facts: false, decisions: false, sources: false, timeline: false, relations: false, validations: false, disputes: false, grants: false, roles: false };
const snapshot = (facts: unknown[]) => ({ memoryCase: { id: "case-a", ownerId: "user-a", governanceStatus: "ACTIVE" }, facts, decisions: [], sources: [], relations: [], validations: [], disputes: [], events: [], grants: [], roles: [], truncated });

test("current knowledge marks a retroactive fact as recorded later", () => {
  const fact = { id: "fact-late", statement: "Effectif en janvier", status: "ESTABLISHED", evidenceLevel: "DECLARED", authorUserId: "user-a", recordedAt: new Date("2026-02-15T00:00:00Z"), effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveUntil: null, establishedAt: new Date("2026-02-15T00:00:00Z"), supersedesFactId: null, supersededByFactId: null };
  const result = buildMemoryState({ snapshot: snapshot([fact]) as never, access, referenceDate: new Date("2026-01-01T12:00:00Z"), knowledgeMode: "CURRENT_KNOWLEDGE_ABOUT_DATE", generatedAt: new Date("2026-03-01T00:00:00Z"), limit: 50, nextCursor: null, includes: new Set(["FACTS"]) });
  assert.equal(result.facts[0].knowledgeTiming, "RECORDED_LATER");
  assert.equal(result.facts[0].statusAtReference, "PROPOSED");
  assert.ok(result.limitations.some(({ code }) => code === "RETROACTIVE_INFORMATION"));
});

test("known-at-date repository cutoff excludes later records", () => {
  const repository = readFileSync("lib/governed-memory/read/repository.ts", "utf8");
  const service = readFileSync("lib/governed-memory/read/service.ts", "utf8");
  assert.match(repository, /recordedAt: \{ lte: input\.knowledgeCutoff \}/);
  assert.match(service, /input\.knowledgeMode === "KNOWN_AT_DATE" \? referenceDate : now/);
});

test("historical fact status uses establishment and succession dates, not current status alone", () => {
  const stateBuilder = readFileSync("lib/governed-memory/read/state-builder.ts", "utf8");
  assert.match(stateBuilder, /row\.establishedAt && row\.establishedAt <= reference/);
  assert.match(stateBuilder, /successor\.effectiveFrom > reference/);
  assert.match(stateBuilder, /STATUS_HISTORY_INCOMPLETE/);
});
