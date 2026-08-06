import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(path, "utf8");
const controls = read("components/governed-journey/GovernedMemoryTransitionControls.tsx");
const section = read("components/governed-journey/GovernedMemoryCockpitSection.tsx");
const page = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");

test("cards render only server capabilities and no source transition", () => {
  assert.match(controls, /capabilities\.canEstablish/); assert.match(controls, /capabilities\.canDispute/); assert.match(controls, /capabilities\.canValidate/);
  assert.doesNotMatch(controls, /item\.status|fact\.status|decision\.status|ROLE_PERMISSIONS|MEMORY_STEWARD|MEMORY_DELEGATE|SOURCE_ARCHIVED|archiveJourneySource/);
  assert.match(section, /item\.capabilities/);
});

test("confirmations preserve server keys and opaque tokens with pending protection", () => {
  assert.match(controls, /type="hidden" name="requestKey"/); assert.match(controls, /type="hidden" name="concurrencyToken"/);
  assert.match(controls, /useFormStatus/); assert.match(controls, /disabled=\{pending\}/); assert.match(controls, /window\.confirm/);
  assert.match(page, /randomUUID\(\)/); assert.doesNotMatch(controls, /randomUUID|requestFingerprint|createHash|createHmac/);
});

test("UI remains canonical, accessible and outside Boussole", () => {
  assert.match(controls, /role="dialog"/); assert.match(controls, /aria-labelledby/); assert.match(controls, /aria-describedby/); assert.match(controls, /firstField\.current\?\.focus/); assert.match(controls, /trigger\.current\?\.focus/);
  assert.doesNotMatch(`${controls}\n${section}`, /data-boussole-id|journeyVersion|\/journeys\//);
  assert.doesNotMatch(`${controls}\n${section}`, /PARTIALLY_APPROVED|REJECTED|WITH_RESERVATIONS|status: "DISPUTED"|notification|invitation|communication|OpenAI|Mistral/);
});
