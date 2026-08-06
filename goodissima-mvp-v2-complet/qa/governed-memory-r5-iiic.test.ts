import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(path, "utf8");
const panel = read("components/governed-journey/GovernedMemoryRolesPanel.tsx");
const actions = read("lib/governed-memory/cockpit-transition-actions.ts");
const actionState = read("lib/governed-memory/cockpit-transition-action-state.ts");
const roleService = read("lib/governed-memory/cockpit-role-service.ts");
const page = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");

test("the active workspace owner may explicitly take the steward function", () => {
  assert.match(actions, /takeJourneyMemoryStewardRoleAction/);
  assert.match(actions, /grantJourneyMemoryRole\(\{ requesterUserId: user\.id, targetUserId: user\.id, formTemplateId, requestKey, role: "MEMORY_STEWARD" \}\)/);
  assert.match(roleService, /workspace: \{ ownerId: input\.requesterUserId, status: "ACTIVE" \}/);
  assert.match(panel, /Prendre la fonction de responsable de la mémoire/);
  assert.match(panel, /Cette prise de fonction sera enregistrée/);
  assert.doesNotMatch(panel, /name="targetUserId"|name="userId"|MEMORY_STEWARD|MEMORY_DELEGATE|Annuaire|email/);
});

test("the organizer steward may explicitly renounce without deleting history", () => {
  assert.match(actions, /renounceJourneyMemoryStewardRoleAction/);
  assert.match(actions, /revokeJourneyMemoryRole\(\{ requesterUserId: user\.id, targetUserId: user\.id, formTemplateId, requestKey, role: "MEMORY_STEWARD" \}\)/);
  assert.match(panel, /Renoncer à la fonction/);
  assert.match(panel, /actions déjà réalisées resteront conservées/);
  assert.match(roleService, /isOrganizerSteward: row\.userId === input\.requesterUserId && row\.role === "MEMORY_STEWARD"/);
});

test("request keys are server-created, distinct and renewed by revalidation", () => {
  assert.match(page, /takeRequestKey=\{randomUUID\(\)\}/);
  assert.match(page, /renounceRequestKey=\{randomUUID\(\)\}/);
  assert.match(actions, /revalidatePath\(`\/gouvernance\/parcours\/\$\{formTemplateId\}\/pilotage`\)/);
  assert.doesNotMatch(panel, /randomUUID|requestFingerprint|requestKey[^\n]*URL/);
});

test("the UI remains explicit, idempotent and outside excluded mechanisms", () => {
  assert.match(panel, /Aucun responsable de la mémoire n’est actuellement en fonction/);
  assert.match(panel, /En fonction/);
  assert.match(actions, /Vous êtes maintenant responsable de la mémoire de ce parcours/);
  assert.match(actions, /Vous n’êtes plus responsable de la mémoire/);
  assert.doesNotMatch(`${panel}\n${actions}`, /invitation|notification|OpenAI|Mistral|vote|quorum|majorité|candidature|data-boussole-id|journeyVersion/);
  assert.doesNotMatch(`${panel}\n${actions}`, /\/journeys\//);
});

test("R5-IIIc adds no migration and preserves server-computed capabilities", () => {
  assert.doesNotMatch(panel, /canEstablish|canDispute|canValidate|ROLE_PERMISSIONS/);
  assert.doesNotMatch(actions, /\$transaction|updateMany|governedJourneyMemoryRoleAssignment\.(?:create|update|delete)/);
  assert.doesNotMatch(read("prisma/schema.prisma"), /R5-IIIc/);
});

test("the use-server module exports async Server Actions only", () => {
  const exportedActions = ["establishJourneyFactAction", "disputeJourneyFactAction", "validateJourneyDecisionAction", "revokeJourneyMemoryRoleAction", "takeJourneyMemoryStewardRoleAction", "renounceJourneyMemoryStewardRoleAction"];
  for (const name of exportedActions) assert.match(actions, new RegExp(`export async function ${name}\\b`));
  assert.doesNotMatch(actions, /export\s+(?:const|let|class|enum|default|\*)\b|export\s*\{/);
  assert.doesNotMatch(actions, /export\s+function\s+/);
  assert.doesNotMatch(actionState, /["']use server["']/);
  assert.match(actionState, /export const initialGovernedMemoryTransitionActionState/);
  assert.match(actionState, /export type GovernedMemoryTransitionActionState/);
});
