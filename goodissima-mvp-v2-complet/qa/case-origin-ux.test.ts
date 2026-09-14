import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { relationCaseOriginHref, relationCaseOriginLabel } from "../lib/case-origin.ts";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";

test("l’origine d’un Dossier reste distincte de l’identité", () => {
  assert.equal(relationCaseOriginLabel("Garde d’enfants le mercredi"), "Réponse à « Garde d’enfants le mercredi »");
  assert.equal(relationCaseOriginLabel("   "), "Via un lien partagé");
  assert.equal(relationCaseOriginLabel(null), "Via un lien partagé");
});

test("le href suit la route métier et reste absent hors du périmètre owner", () => {
  const opportunity = { id: "opportunity", ownerId: "owner", rules: { creationSource: "opportunity", opportunity: { schemaVersion: 1, type: "NEED", criteria: { subject: "Garde" } } }, templateId: null };
  assert.equal(relationCaseOriginHref("owner", opportunity), "/opportunities/opportunity");
  assert.deepEqual([opportunity, opportunity].map(link => relationCaseOriginHref("owner", link)), ["/opportunities/opportunity", "/opportunities/opportunity"]);
  assert.equal(relationCaseOriginHref("other", opportunity), null);
  assert.equal(relationCaseOriginHref("owner", null), null);
  assert.equal(relationCaseOriginHref("owner", { ...opportunity, id: "shared link", rules: { simpleLink: true } }), "/links/shared%20link");
});

test("seul le titre d’origine est un lien accessible avec une cible tactile", () => {
  const { RelationCaseOrigin } = loadTestModule("components/RelationCaseOrigin.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }),
  });
  const linked = renderToStaticMarkup(jsx.jsx(RelationCaseOrigin, { title: "Recherche de baby-sitter", href: "/opportunities/source" }));
  assert.match(linked, /Réponse à « <a [^>]*href="\/opportunities\/source"[^>]*>Recherche de baby-sitter<\/a> »/);
  assert.match(linked, /min-h-11/);
  assert.match(linked, /focus-visible:outline/);
  assert.doesNotMatch(renderToStaticMarkup(jsx.jsx(RelationCaseOrigin, { title: "Origine privée", href: null })), /<a /);
  assert.doesNotMatch(renderToStaticMarkup(jsx.jsx(RelationCaseOrigin, { title: null, href: "/links/secret" })), /<a /);
});

test("les collections Dossiers affichent l’origine sans identifiant technique", async () => {
  const files = await Promise.all([
    readFile("app/(connected)/cases/page.tsx", "utf8"),
    readFile("components/SpacesExistingAttachments.tsx", "utf8"),
    readFile("components/WorkspaceDetailView.tsx", "utf8"),
  ]);

  for (const source of files) assert.match(source, /RelationCaseOrigin/);
  assert.doesNotMatch(files.join("\n"), /Réponse à.*(?:gLinkId|Opportunity ID|token)/i);
});
