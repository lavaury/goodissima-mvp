import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { objectActionRow } from "./helpers/object-action-row.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as pagination from "../lib/unassigned-pagination.ts";

test("universal button is named, focusable, non-submitting and does not replace the open link", () => {
  const html = renderToStaticMarkup(jsx.jsx(objectActionRow.ObjectActionRow, { as: "li", name: "Dossier Alice", href: "/cases/one", children: jsx.jsx("a", { href: "/cases/one", children: "Ouvrir" }) }));
  assert.match(html, /aria-label="Actions pour Dossier Alice"/);
  assert.match(html, /type="button"/); assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="false"/); assert.match(html, /•••/);
  assert.match(html, /href="\/cases\/one"/); assert.doesNotMatch(html, /role="menuitem"/);
});
test("unopenable objects do not receive invented actions", () => {
  const html = renderToStaticMarkup(jsx.jsx(objectActionRow.ObjectActionRow, { name: "Sans formulaire", href: null, children: "Aucun formulaire" }));
  assert.doesNotMatch(html, /<button|data-object-action-row/);
});
test("one menu definition, local context handler, and attachment never submits", () => {
  const source = readFileSync("components/ObjectActionRow.tsx", "utf8");
  assert.equal(source.split("actions.map(").length - 1, 1);
  assert.doesNotMatch(source, /addEventListener\("contextmenu"|fetch\(|requestSubmit\(|\.submit\(|ownerId/);
  assert.match(source, /target\?\.querySelector<HTMLElement>\("select"\)/);
  assert.match(source, /event\.preventDefault\(\); event\.stopPropagation\(\); setOpen\(true\)/);
});
test("unassigned surfaces retain owner destinations, attachment mode and warning before confirmation", async () => {
  const row = { id: "one", title: "Objet", createdAt: new Date(), href: "/cases/one", gLinkTitle: "Parent" };
  const component = loadTestModule("components/SpacesExistingAttachments.tsx", {
    "react/jsx-runtime": jsx, "@/components/ObjectActionRow": objectActionRow,
    "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }),
    "@/lib/unassigned-pagination": pagination,
    "@/lib/governance-workspace-actions": { attachGLinkToWorkspaceAction: "/link", attachGovernedJourneyToWorkspaceAction: "/journey", attachRelationCaseToWorkspaceAction: "/case" },
    "@/lib/governance-workspace-repository": {
      getGovernanceWorkspaceOptions: async () => [{ id: "w", name: "Workspace", categoryLabel: "Projet" }],
      getUnassignedGLinkSummaries: async () => ({ items: [{ ...row, href: "/links/one", objectLabel: "Lien simple" }, { ...row, id: "two", href: "/links/two", objectLabel: "Opportunité" }], hasMore: false }),
      getUnassignedGovernedJourneySummaries: async () => ({ items: [{ ...row, formTemplateId: "form", href: "/gouvernance/parcours/form/pilotage" }], hasMore: false }),
      getUnassignedRelationCaseSummaries: async () => ({ items: [row], hasMore: false }),
    },
  });
  const html = renderToStaticMarkup(await component.SpacesExistingAttachments({ ownerId: "fixture" }));
  assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 4);
  assert.equal((html.match(/name="attachmentMode" value="unassigned"/g) ?? []).length, 4);
  assert.ok(html.indexOf("Le lien parent") < html.indexOf('id="attach-case-one"'));
  assert.match(html, /href="\/cases\/one"/); assert.match(html, /href="\/links\/two"/);
  assert.doesNotMatch(html, /attachUnassignedCases|\/secure\//);
});
test("attached Workspace rows never receive an attachment action", () => {
  const source = readFileSync("components/WorkspaceDetailView.tsx", "utf8") + readFileSync("components/WorkspaceRow.tsx", "utf8") + readFileSync("components/SpacesTreeView.tsx", "utf8");
  assert.doesNotMatch(source, /attachmentTargetId/);
});
