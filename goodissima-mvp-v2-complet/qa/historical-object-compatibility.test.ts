import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";

const page = readFileSync("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", "utf8");

test("l’URL historique classe avant de charger les services du cockpit Journey", () => {
  assert.ok(page.indexOf('classification !== "JOURNEY"') < page.indexOf("getGovernanceWorkspaceOptions(owner.id)"));
  assert.match(page, /getTemplateReadAccess\(owner, params\.id\)/);
  assert.match(page, /relationCases: \{ where: \{ ownerId: owner\.id \}/);
  assert.match(page, /links: \{ where: \{ ownerId: owner\.id \}/);
  assert.doesNotMatch(page, /redirect.*MODERN_OPPORTUNITY/);
});

test("la vue Opportunity historique reste légère et la vue ambiguë reste neutre", () => {
  const { HistoricalTemplateCompatibilityView } = loadTestModule("components/HistoricalTemplateCompatibilityView.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }),
  });
  const render = (ambiguous: boolean) => renderToStaticMarkup(jsx.jsx(HistoricalTemplateCompatibilityView, {
    title: "Recherche de garage", description: "Description", ambiguous,
    links: [{ title: "Garage", status: "ACTIVE", href: "/links/link" }],
    cases: [{ candidateName: "", href: "/cases/case" }],
  }));
  const historical = render(false);
  assert.match(historical, /Opportunité historique/);
  assert.match(historical, /Publication ou lien associé/);
  assert.match(historical, /Candidat non identifié/);
  assert.doesNotMatch(historical, /Workspace du parcours|validation humaine|synthèse du parcours gouverné/i);
  assert.match(render(true), /Objet historique à vérifier/);
});

test("aucun rapprochement ne fusionne un template historique avec une Opportunity moderne", () => {
  assert.doesNotMatch(page, /findFirst[\s\S]{0,160}(?:same|correspond|duplicate|doublon)/i);
});
