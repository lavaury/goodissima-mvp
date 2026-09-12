import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as projection from "../lib/opportunities/opportunity-projection.ts";

const rules = projection.buildOpportunityRulesV1({}, { type: "NEED", criteria: {
  subject: "baby-sitter", locations: ["Beauvais"], availability: { days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00", timeTo: "20:00" },
} });

function page(ownerId: string, row: any) {
  return loadTestModule<any>("app/(connected)/opportunities/[id]/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }),
    "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); }, redirect: (href: string) => { throw Error(`REDIRECT ${href}`); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: ownerId }) },
    "@/lib/prisma": { prisma: { gLink: { findFirst: async ({ where }: any) => row && row.id === where.id && row.ownerId === where.ownerId ? row : null } } },
    "@/lib/opportunities/opportunity-projection": projection,
  }).default;
}

test("the autonomous DRAFT page is owner-scoped, calm and complete", async () => {
  const row = { id: "draft", ownerId: "owner", title: "Recherche de baby-sitter à Beauvais", description: "Besoin régulier.", status: "DRAFT", templateId: null, rules };
  const html = renderToStaticMarkup(await page("owner", row)({ params: { id: "draft" } }));
  for (const text of ["Brouillon", "Je recherche", "baby-sitter", "Beauvais", "Mardi, Jeudi", "18:00", "20:00", "Description", "Voir dans Mes espaces"]) assert.ok(html.includes(text), text);
  for (const forbidden of ["QR", "lien public", "Partager", "matching", "Parcours", "Dashboard", "Relation Studio"]) assert.ok(!html.includes(forbidden), forbidden);
  await assert.rejects(page("other", row)({ params: { id: "draft" } }), /NOT_FOUND/);
  await assert.rejects(page("owner", row)({ params: { id: "missing" } }), /NOT_FOUND/);
});

test("OFFER renders its wording, empty properties stay absent and legacy redirects", async () => {
  const offerRules = projection.buildOpportunityRulesV1({}, { type: "OFFER", criteria: { subject: "cours d’anglais" } });
  const offer = { id: "offer", ownerId: "owner", title: "Cours d’anglais", description: "", status: "DRAFT", templateId: null, rules: offerRules };
  const html = renderToStaticMarkup(await page("owner", offer)({ params: { id: "offer" } }));
  assert.ok(html.includes("Je propose")); assert.ok(!html.includes("Lieu") && !html.includes("Horaires") && !html.includes("Description"));
  await assert.rejects(page("owner", { ...offer, id: "legacy", templateId: "journey", rules: { creationSource: "opportunity" } })({ params: { id: "legacy" } }), /REDIRECT \/links\/legacy/);
  await assert.rejects(page("owner", { ...offer, id: "not-opportunity", rules: { simpleLink: true } })({ params: { id: "not-opportunity" } }), /NOT_FOUND/);
});
