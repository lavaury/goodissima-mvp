import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const workspace = readFileSync("components/RelationCaseWorkspace.tsx", "utf8");
const route = readFileSync("app/cases/[caseId]/memory/page.tsx", "utf8");
const page = readFileSync("components/governed-memory/GovernedMemoryPage.tsx", "utf8");

test("owner workspace links to case-scoped memory and offers a return path", () => {
  assert.match(workspace, /senderType === "OWNER"[\s\S]*\/memory/); assert.match(workspace, />Mémoire</); assert.match(route, /Retour au dossier/); assert.match(route, /relationCaseId=\{params\.caseId\}/);
});

test("authorized non-sensitive view state is preserved in the URL", () => {
  assert.match(page, /params\.set\("view"/); assert.match(page, /referenceDate/); assert.match(page, /knowledgeMode/); assert.match(page, /params\.toString\(\)/);
  assert.doesNotMatch(page, /params\.set\("(cursor|decisionId|sourceId|subjectUserId|statement|rationale)"/);
});

