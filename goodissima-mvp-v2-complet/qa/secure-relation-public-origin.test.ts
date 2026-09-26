import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { relationCaseOriginNavigation } from "../lib/relation-case-origin-navigation.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const simpleRules = { simpleLink: true };
const opportunityRules = { creationSource: "opportunity", opportunity: { schemaVersion: 1, type: "NEED", criteria: { subject: "Projet" } } };

test("candidate origins use the public route in a new tab", () => {
  assert.deepEqual(relationCaseOriginNavigation({ senderType: "CANDIDATE", gLink: { id: "private-id", slug: "lien-public", rules: simpleRules } }), {
    href: "/l/lien-public?context=1", label: "Voir le lien d'origine", opensNewTab: true,
  });
  assert.deepEqual(relationCaseOriginNavigation({ senderType: "CANDIDATE", gLink: { id: "private-id", slug: "annonce-publique", rules: opportunityRules } }), {
    href: "/l/annonce-publique?context=1", label: "Voir l'annonce d'origine", opensNewTab: true,
  });
  const workspace = source("components/RelationCaseWorkspace.tsx");
  assert.match(workspace, /target=\{originNavigation\.opensNewTab \? "_blank"/);
  assert.match(workspace, /rel=\{originNavigation\.opensNewTab \? "noreferrer"/);
});

test("owner origin stays private and a legacy candidate origin without slug is plain text", () => {
  assert.deepEqual(relationCaseOriginNavigation({ senderType: "OWNER", gLink: { id: "owner link", slug: "public", rules: simpleRules } }), {
    href: "/links/owner%20link", label: "Voir le lien d'origine", opensNewTab: false,
  });
  assert.deepEqual(relationCaseOriginNavigation({ senderType: "CANDIDATE", gLink: { id: "legacy", slug: null, rules: null } }), {
    href: null, label: "Voir l'origine", opensNewTab: false,
  });
});

test("secure loading includes public classification rules", () => {
  const securePage = source("app/secure/[token]/page.tsx");
  assert.match(securePage, /select: \{ id: true, title: true, slug: true, rules: true \}/);
});

test("explicit public context bypasses only the historical candidate-cookie redirect", () => {
  const publicPage = source("app/l/[slug]/page.tsx");
  assert.match(publicPage, /const publicContextOnly = searchParams\?\.context === "1"/);
  assert.match(publicPage, /candidateCookie && !publicContextOnly/);
  assert.match(publicPage, /status !== "ACTIVE"/);
  assert.match(publicPage, /redirect\(`\/secure\//);
});
