import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("governance review follows explicit human-only transitions", () => {
  const actions = source("lib/governance-review-preparations-actions.ts");
  const page = source("app/gouvernance/parcours/[id]/pilotage/page.tsx");
  const signals = source("lib/governance-cockpit-consolidation-repository.ts");
  const assistant = source("components/GovernanceReviewAIAssistant.tsx");
  const button = source("components/ConfirmGovernanceReviewTransitionButton.tsx");

  assert.match(actions, /PREPARED_NOT_STARTED.*IN_HUMAN_REVIEW/s);
  assert.match(actions, /IN_HUMAN_REVIEW.*COMPLETED/s);
  assert.match(actions, /humanConfirmed/);
  assert.match(actions, /startedAt: nextStatus === "IN_HUMAN_REVIEW" \? now/);
  assert.match(actions, /completedAt: nextStatus === "COMPLETED" \? now/);
  assert.doesNotMatch(actions, /sendEmail\(|notification\.create|meeting\.create|startWorkflow\(|Mistral|LiveKit/i);
  assert.match(button, /Conduire la revue/);
  assert.match(button, /Marquer comme conduite/);
  assert.match(page, /id=\{`governance-review-\$\{review\.reviewPreparationId\}`\}/);
  assert.match(signals, /#governance-review-/);
  assert.match(signals, /Revue en conduite humaine/);
  assert.match(signals, /Revue conduite/);
  assert.match(assistant, /Copier l’aide/);
});