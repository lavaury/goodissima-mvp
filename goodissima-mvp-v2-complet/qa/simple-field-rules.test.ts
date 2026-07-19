import test from "node:test";
import assert from "node:assert/strict";
import { describeSimpleFieldRule, evaluateSimpleFieldRule } from "../lib/simple-field-rules.ts";

test("number rules distinguish valid and invalid answers", () => {
  const rule = { operator: "LTE", mode: "INDICATIVE", value: "1000" } as const;
  assert.equal(evaluateSimpleFieldRule("900", rule).valid, true);
  assert.equal(evaluateSimpleFieldRule("1200", rule).valid, false);
  assert.equal(describeSimpleFieldRule({ label: "Loyer", validationRules: rule }), "Loyer doit être inférieur ou égal à 1000 €");
});

test("location radius stays declarative", () => {
  const rule = { operator: "CITY_RADIUS", mode: "INDICATIVE", city: "Nice", radiusKm: 15, declarative: true } as const;
  assert.equal(evaluateSimpleFieldRule("Antibes", rule).valid, true);
  assert.match(describeSimpleFieldRule({ label: "Localisation", validationRules: rule }), /à vérifier humainement/);
});

test("text and date rules are evaluated locally", () => {
  assert.equal(evaluateSimpleFieldRule("Bonjour", { operator: "MAX_LENGTH", mode: "BLOCKING", value: "5" }).valid, false);
  assert.equal(evaluateSimpleFieldRule("2027-01-01", { operator: "DATE_AFTER", mode: "BLOCKING", value: "2026-01-01" }).valid, true);
});
