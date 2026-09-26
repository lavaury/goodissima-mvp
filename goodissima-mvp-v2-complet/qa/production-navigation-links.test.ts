import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyGLink, classifyRelationTemplate } from "../lib/business-object-classification.ts";
import { logicalParent, objectBreadcrumb } from "../lib/spatial-navigation.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a historical announcement needs positive snapshot evidence", () => {
  const villaRules = { requireEmail: true, allowDocument: true, requireMessage: true };
  assert.equal(classifyGLink(villaRules), "LEGACY_AMBIGUOUS");
  assert.equal(classifyRelationTemplate({ metadata: { opportunityPresentation: {} } }), "LEGACY_OPPORTUNITY");
  assert.equal(classifyRelationTemplate({ metadata: {} }), "LEGACY_AMBIGUOUS");
  assert.equal(classifyRelationTemplate({ metadata: { opportunityPresentation: {}, creationPlan: { title: "Journey" } } }), "LEGACY_AMBIGUOUS");
  assert.equal(classifyGLink({ simpleLink: true }), "SIMPLE_LINK");

  const page = source("app/(connected)/cases/[caseId]/page.tsx");
  assert.match(page, /templateVersion: \{ select: \{ snapshot: true \} \}/);
  assert.match(page, /classifyGLink\(item\.gLink\.rules\)/);
  assert.match(page, /classifyRelationTemplate\(item\.gLink\.templateVersion\.snapshot\) === "LEGACY_OPPORTUNITY"/);
  assert.match(page, /originKind=\{originKind\}/);
  assert.match(page, /: "UNKNOWN"/);
});

test("the case origin retains its route and uses a kind-specific label", () => {
  const component = source("components/RelationCaseWorkspace.tsx");
  const navigation = source("lib/relation-case-origin-navigation.ts");
  assert.match(component, /href=\{originNavigation\.href\}/);
  assert.match(navigation, /`\/links\/\$\{encodeURIComponent\(gLink\.id\)\}`/);
  assert.match(navigation, /"Voir l'annonce d'origine"/);
  assert.match(navigation, /"Voir le lien d'origine"/);
  assert.match(navigation, /"Voir l'origine"/);
});

test("link detail uses the shared, valid logical parent with or without Workspace", () => {
  const page = source("app/(connected)/links/[linkId]/page.tsx");
  assert.match(page, /items=\{objectBreadcrumb\(\{ name: link\.title, fallback: objectLabel, objectId: link\.id, ownerId: owner\.id, workspace: link\.workspace \}\)\}/);
  assert.doesNotMatch(page, /["'`]\/spaces["'`]/);
  const base = { name: "Villa", fallback: "Lien", objectId: "link-id", ownerId: "owner" };
  assert.equal(logicalParent(objectBreadcrumb(base))?.href, "/gouvernance");
  assert.equal(logicalParent(objectBreadcrumb({ ...base, workspace: { id: "workspace-id", name: "Équipe", ownerId: "owner", portfolio: null } }))?.href, "/gouvernance/workspaces/workspace-id");
  assert.equal(logicalParent(objectBreadcrumb({ ...base, workspace: { id: "workspace-id", name: "Équipe", ownerId: "other", portfolio: null } }))?.href, "/gouvernance");
});
