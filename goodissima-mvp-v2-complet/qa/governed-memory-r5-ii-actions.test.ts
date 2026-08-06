import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("lib/governed-memory/cockpit-creation-actions.ts", "utf8");
const page = readFileSync("app/gouvernance/parcours/[id]/pilotage/page.tsx", "utf8");

test("three thin actions authenticate, delegate and revalidate R4", () => {
  for (const name of ["retainJourneyFactAction", "retainJourneyDecisionAction", "retainJourneySourceAction"]) assert.match(actions, new RegExp(`export async function ${name}`));
  for (const command of ["proposeJourneyFact", "createJourneyDecisionDraft", "registerJourneySource"]) assert.match(actions, new RegExp(command));
  assert.match(actions, /getCurrentPrismaUser/);
  assert.match(actions, /revalidatePath\(`\/gouvernance\/parcours\/\$\{formTemplateId\}\/pilotage`\)/);
  assert.doesNotMatch(actions, /prisma|fingerprint|workspace\.find|governedJourney.*find|relationCaseId/);
});

test("request keys are distinct server-generated values and never returned", () => {
  assert.match(page, /randomUUID\(\), decision: randomUUID\(\), source: randomUUID\(\)/);
  assert.doesNotMatch(actions, /randomUUID|requestFingerprint|publicMemoryKey/);
  assert.doesNotMatch(actions, /return .*requestKey/);
});
