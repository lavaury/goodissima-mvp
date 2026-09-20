import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boussoleRegistry } from "../lib/boussole/registry.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function normalizedIdentifier(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

test("registered journeys are independently versioned and resumable", () => {
  for (const { journeys } of boussoleRegistry) {
    for (const journey of journeys) {
      assert.ok(Number.isInteger(journey.version) && journey.version > 0, `${journey.id}: invalid journeyVersion`);
      assert.ok(journey.steps.length > 0, `${journey.id}: empty journey`);
      assert.ok(journey.applicableStates.length > 0, `${journey.id}: empty applicableStates`);
      for (const step of journey.steps) {
        assert.ok(step.id, `${journey.id}: resumable step without stepId`);
        assert.notEqual(step.id, normalizedIdentifier(step.title), `${journey.id}: stepId derived from visible title`);
      }
    }
  }
});

test("real-object strategies and optional fallbacks remain scoped", () => {
  for (const { journeys } of boussoleRegistry) {
    for (const journey of journeys) {
      const targets = new Set(journey.steps.flatMap((step) => step.targetId ? [step.targetId] : []));
      for (const step of journey.steps) {
        if (step.targetStrategy?.kind === "FIRST_VISIBLE_MATCH") assert.ok(step.targetStrategy.objectType, `${journey.id}/${step.id}: missing objectType`);
        if (step.optional && step.fallbackTargetId) assert.ok(targets.has(step.fallbackTargetId), `${journey.id}/${step.id}: fallback outside journey`);
      }
    }
  }
});

test("progression contract contains functional metadata only", () => {
  const contracts = read("lib/boussole/contracts.ts");
  const progressContract = contracts.slice(contracts.indexOf("export type BoussoleProgress ="), contracts.indexOf("export type BoussoleProgressStore ="));
  for (const field of ["pageId", "journeyId", "journeyVersion", "stepId", "updatedAt"]) assert.match(progressContract, new RegExp(`\\b${field}\\b`));
  assert.doesNotMatch(progressContract, /token|secure|url|email|candidate|message|document|attachment|secret/i);
});

test("maintenance documentation covers the durable workflow", () => {
  const documentation = read("docs/boussole-maintenance.md").toLowerCase();
  for (const subject of ["version des micro-parcours", "identifiants stables", "états réels", "cibles et fallback", "sécurité", "checklist d’impact", "procédure git"]) {
    assert.ok(documentation.includes(subject), `missing documentation subject: ${subject}`);
  }
  for (const command of ["qa:boussole-maintenance", "npm.cmd run build", "git diff --check", "tsconfig.tsbuildinfo"]) assert.ok(documentation.includes(command));
});
