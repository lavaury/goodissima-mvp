import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const section = read("components/governed-journey/GovernedMemoryCockpitSection.tsx");
const panel = read("components/governed-journey/GovernedMemoryCreationPanel.tsx");

test("R5-II stays in the canonical cockpit and outside Boussole", () => {
  assert.match(page, /GovernedMemoryCockpitSection/);
  assert.match(panel, /Retenir dans la mémoire/);
  assert.doesNotMatch(`${section}\n${panel}`, /data-boussole-id|journeyVersion/);
  assert.doesNotMatch(panel, /governedJourneyId|relationTemplateId|relationCaseId|requestFingerprint|publicMemoryKey/);
});

test("only server-authorized categories are rendered", () => {
  for (const category of ["fact", "decision", "source"]) assert.match(panel, new RegExp(`capabilities\\.categories\\.${category}`));
  assert.match(panel, /if \(!capabilities\.canCreateAny\) return null/);
  assert.match(panel, /Source déterminante/);
});

test("forms announce honest initial states and submit explicitly", () => {
  assert.match(panel, /proposition de fait/);
  assert.match(panel, /comme brouillon/);
  assert.match(panel, /comme active/);
  assert.match(panel, /type="submit"/);
  assert.match(panel, /disabled=\{pending\}/);
  assert.doesNotMatch(panel, /autosave|onChange=.*Action|Valider la décision|Fait établi/i);
});
