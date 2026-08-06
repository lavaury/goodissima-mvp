import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(path, "utf8");
const actions = read("lib/governed-memory/cockpit-transition-actions.ts");

test("thin transition actions authenticate, parse, delegate and revalidate R4", () => {
  for (const name of ["establishJourneyFactAction", "disputeJourneyFactAction", "validateJourneyDecisionAction", "revokeJourneyMemoryRoleAction"]) assert.match(actions, new RegExp(`export const ${name}`));
  assert.match(actions, /getCurrentPrismaUser/); assert.match(actions, /revalidatePath\(`\/gouvernance\/parcours\/\$\{formTemplateId\}\/pilotage`\)/);
  assert.doesNotMatch(actions, /\$transaction|updateMany|ROLE_PERMISSIONS|authorityUserId|requestFingerprint/);
});

test("public action states expose bounded French feedback without technical results", () => {
  assert.match(actions, /GovernedMemoryTransitionActionState/);
  for (const message of ["Le fait est maintenant établi", "La contestation a été ouverte", "La décision a été validée", "Les actions historiques restent conservées"]) assert.match(actions, new RegExp(message));
  assert.doesNotMatch(actions, /validationId|disputeId|eventId|assignmentId|relationTemplateId|governedJourneyId|PrismaClient|\bSQL\b|\.stack/);
});
