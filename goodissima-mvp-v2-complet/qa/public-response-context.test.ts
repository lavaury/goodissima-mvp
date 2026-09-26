import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const context = read("components/PublicResponseContext.tsx");
const page = read("app/l/[slug]/page.tsx");
const autonomous = read("components/PublicAutonomousOpportunity.tsx");
const exchange = read("components/PublicOpportunitySecureExchange.tsx");

test("simple links show title, optional description and distinct welcome without announcement wording", () => {
  assert.match(context, /kind === "SIMPLE_LINK" \? "Vous répondez à ce lien"/);
  assert.match(context, /<h3[^>]*>\{title\}<\/h3>/);
  assert.match(context, /\{description \?/);
  assert.match(context, /welcomeMessage\.trim\(\) !== description\?\.trim\(\)/);
  assert.match(page, /kind=\{isSimpleLink \? "SIMPLE_LINK" : "OPPORTUNITY"\}/);
  assert.match(page, /welcomeMessage=\{isSimpleLink \? welcomeMessage : null\}/);
  assert.match(context, /kind === "SIMPLE_LINK" \? "Vous répondez à ce lien" : "Vous répondez à cette annonce"/);
});

test("modern and legacy opportunities reuse compact public-only context", () => {
  assert.match(context, /Vous répondez à cette annonce/);
  assert.match(context, /↑ Voir l’annonce complète/);
  assert.match(page, /<PublicOpportunityCard/);
  assert.match(page, /<PublicResponseContext[^>]*kind=\{isSimpleLink/);
  assert.match(autonomous, /id="public-link-context"/);
  assert.match(autonomous, /structuredCriteria/);
  assert.match(autonomous, /responseDetails/);
  assert.match(exchange, /<PublicResponseContext kind="OPPORTUNITY"/);
});

test("response context links to one stable in-page public presentation anchor", () => {
  assert.match(page, /id="public-link-context"/);
  assert.match(autonomous, /id="public-link-context"/);
  assert.match(context, /href="#public-link-context"/);
  assert.match(context, /kind === "OPPORTUNITY" \? <a/);
  assert.doesNotMatch(context, /Remonter au contexte complet/);
  assert.doesNotMatch(context, /href=\{`?\/(?:api|secure|cases)/);
});

test("compact context accepts no private identity, owner, token or storage data", () => {
  for (const forbidden of ["owner", "email", "candidate", "token", "storage", "requestPayload", "relationCase"]) assert.doesNotMatch(context, new RegExp(forbidden, "i"));
  assert.match(context, /title: string/);
  assert.match(context, /description\?: string \| null/);
  assert.match(context, /details\?: ResponseContextDetail\[\]/);
});
