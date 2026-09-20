import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildOpportunityRulesV1,
  isAutonomousModernOpportunity,
  opportunityOwnerHref,
} from "../lib/opportunities/opportunity-projection.ts";
import { linkObjectLabel } from "../lib/object-creation.ts";

const modernRules = buildOpportunityRulesV1({}, {
  type: "NEED",
  criteria: { subject: "baby-sitter", locations: ["Beauvais"] },
});
const referenceModernOpportunity = {
  id: "cmtyadhxh000ds341o17bo000",
  templateId: null,
  rules: modernRules,
};

test("modern autonomous opportunities use the owner route from every entry point", () => {
  assert.equal(isAutonomousModernOpportunity(referenceModernOpportunity), true);
  assert.equal(opportunityOwnerHref(referenceModernOpportunity), "/opportunities/cmtyadhxh000ds341o17bo000");

  const linkPage = readFileSync(new URL("../app/(connected)/links/[linkId]/page.tsx", import.meta.url), "utf8");
  assert.match(linkPage, /if \(isAutonomousModernOpportunity\(link\)\)/);
  assert.match(linkPage, /redirect\(`\/opportunities\/\$\{encodeURIComponent\(link\.id\)\}`\)/);
  assert.ok(linkPage.indexOf("isAutonomousModernOpportunity(link)") < linkPage.indexOf("const activeFallbackVersion"));
});

test("simple links stay on the link owner route and keep their factual label", () => {
  const simple = { id: "simple", templateId: null, rules: { simpleLink: true } };
  assert.equal(isAutonomousModernOpportunity(simple), false);
  assert.equal(opportunityOwnerHref(simple), "/links/simple");
  assert.equal(linkObjectLabel(simple.rules), "Lien simple");
});

test("legacy, governed and invalid opportunities keep the historical route", () => {
  const legacy = { id: "legacy", templateId: null, rules: { creationSource: "opportunity" } };
  const governed = { id: "governed", templateId: "journey", rules: modernRules };
  const invalid = { id: "invalid", templateId: null, rules: { creationSource: "opportunity", opportunity: { schemaVersion: 1 } } };

  for (const item of [legacy, governed, invalid]) {
    assert.equal(isAutonomousModernOpportunity(item), false);
    assert.equal(opportunityOwnerHref(item), `/links/${item.id}`);
    assert.equal(linkObjectLabel(item.rules), "Opportunité");
  }
});

test("owner routes are complementary and cannot redirect the same class in a loop", () => {
  const opportunityPage = readFileSync(new URL("../app/(connected)/opportunities/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(opportunityPage, /if \(projection\.legacy \|\| projection\.hasGovernedJourney\) redirect\(`\/links\//);
  assert.equal(isAutonomousModernOpportunity(referenceModernOpportunity), true);
  assert.equal(isAutonomousModernOpportunity({ ...referenceModernOpportunity, templateId: "journey" }), false);
});
