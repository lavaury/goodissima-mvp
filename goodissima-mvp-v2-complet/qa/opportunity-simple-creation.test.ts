import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretOpportunityPhrase, OPPORTUNITY_INTENT_RESPONSE_FORMAT, parseOpportunityIntent, suggestOpportunityTitle } from "../lib/opportunities/opportunity-intent.ts";
import { buildOpportunityRulesV1, opportunityOwnerHref } from "../lib/opportunities/opportunity-projection.ts";
import { parseOpportunityCriteriaV1 } from "../lib/opportunities/contracts.ts";
import { slugify } from "../lib/slug.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const result = (output: string) => ({ output, provider: "mock" as const, model: "test", tokensInput: 1, tokensOutput: 1, estimatedCostEur: 0, latencyMs: 1 });
const options = (output: string) => ({ provider: { name: "mock" as const, model: "test", chat: async () => result(output) } as never, recordEvent: async () => undefined });

test("interprets the exact baby-sitter NEED without inventing criteria", async () => {
  const phrase = "je recherche une baby sitter pour les mardis et jeudis à partir de 18h et jusqu'à 20h dans le secteur de beauvais.";
  const intent = await interpretOpportunityPhrase(phrase, options(JSON.stringify({ type: "NEED", subject: "baby-sitter", locations: ["Beauvais"], days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00", timeTo: "20:00" })));
  assert.deepEqual(intent, { type: "NEED", subject: "baby-sitter", locations: ["Beauvais"], days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00", timeTo: "20:00" });
  assert.equal(suggestOpportunityTitle(intent), "Recherche de baby-sitter à Beauvais");
});

test("interprets the English-course OFFER without adding criteria", async () => {
  const intent = await interpretOpportunityPhrase("Je propose des cours d’anglais à Lille", options(JSON.stringify({ type: "OFFER", subject: "cours d’anglais", locations: ["Lille"] })));
  assert.deepEqual(intent, { type: "OFFER", subject: "cours d’anglais", locations: ["Lille"] });
  assert.equal(suggestOpportunityTitle(intent), "Cours d’anglais proposés à Lille");
});

test("keeps ambiguity explicit and rejects invalid or unknown provider fields", async () => {
  assert.equal((await interpretOpportunityPhrase("Une aide à Beauvais", options(JSON.stringify({ type: null, subject: "aide", locations: ["Beauvais"] })))).type, null);
  assert.throws(() => parseOpportunityIntent({ type: "MAYBE", subject: "aide" }));
  assert.throws(() => parseOpportunityIntent({ type: "NEED", subject: "aide", invented: true }));
  await assert.rejects(() => interpretOpportunityPhrase("Une aide", options("not json")));
  await assert.rejects(() => interpretOpportunityPhrase("Une aide", { provider: { name: "mock", model: "test", chat: async () => { throw new Error("offline"); } } as never, recordEvent: async () => undefined }));
});

test("uses Mistral-compatible strict schema and keeps uniqueness in application validation", () => {
  const schema = OPPORTUNITY_INTENT_RESPONSE_FORMAT.json_schema.schema as any;
  assert.equal(schema.additionalProperties, false); assert.equal(schema.properties.days.uniqueItems, undefined);
  assert.throws(() => parseOpportunityIntent({ type: "NEED", subject: "aide", days: ["TUESDAY", "TUESDAY"] }));
});

function createRoute(owner: { id: string } | null, calls: Array<{ model: string; data: unknown }>) {
  const prisma = new Proxy({ gLink: { create: async ({ data }: { data: unknown }) => { calls.push({ model: "GLink", data }); return { id: "draft-1", slug: "draft-slug", status: "DRAFT" }; } } } as Record<string, unknown>, {
    get(target, key) { if (key in target) return target[key as string]; return new Proxy({}, { get: (_unused, operation) => async () => { calls.push({ model: `${String(key)}.${String(operation)}`, data: null }); } }); },
  });
  return loadTestModule<any>("app/api/opportunities/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "next/cache": { revalidatePath() {} },
    "@/lib/auth": { getCurrentPrismaUser: async () => owner ?? Promise.reject(new Error("UNAUTHENTICATED")) },
    "@/lib/prisma": { prisma }, "@/lib/slug": { slugify },
    "@/lib/opportunities/opportunity-projection": { buildOpportunityRulesV1 },
    "@/lib/opportunities/contracts": { parseOpportunityCriteriaV1 },
  });
}

const validBody = { type: "NEED", criteria: { subject: "baby-sitter", locations: ["Beauvais"], availability: { days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00" } }, title: "Recherche de baby-sitter à Beauvais", description: "Je recherche une baby-sitter à Beauvais." };

test("creation takes its owner from the server and persists one autonomous DRAFT", async () => {
  const calls: Array<{ model: string; data: any }> = [];
  const route = createRoute({ id: "server-owner" }, calls);
  const response = await route.POST({ json: async () => validBody });
  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "GLink");
  assert.equal(calls[0].data.ownerId, "server-owner"); assert.equal(calls[0].data.status, "DRAFT");
  assert.equal(calls[0].data.workspaceId, null); assert.equal(calls[0].data.templateId, null); assert.equal(calls[0].data.templateVersionId, null); assert.equal(calls[0].data.city, "Beauvais");
  assert.deepEqual(calls[0].data.rules.opportunity, { schemaVersion: 1, type: "NEED", criteria: validBody.criteria });
  assert.equal(calls[0].data.rules.creationSource, "opportunity");
  assert.equal("simpleLink" in calls[0].data.rules, false);
  assert.match(calls[0].data.slug, /^recherche-de-baby-sitter-a-beauvais-/);
});

test("creation rejects unauthenticated, client owner and invalid entries without persistence", async () => {
  await assert.rejects(() => createRoute(null, []).POST({ json: async () => validBody }));
  for (const body of [{ ...validBody, ownerId: "client-owner" }, { ...validBody, type: null }, { ...validBody, criteria: { subject: "x", invented: true } }]) {
    const calls: Array<{ model: string; data: unknown }> = [];
    const response = await createRoute({ id: "server-owner" }, calls).POST({ json: async () => body });
    assert.equal(response.status, 400); assert.deepEqual(calls, []);
  }
});

test("the new UI has one editor, a manual fallback and no governed-journey vocabulary", () => {
  const page = read("app/(connected)/opportunities/new/page.tsx");
  const creator = read("components/OpportunityDraftCreator.tsx");
  assert.match(creator, /Que recherchez-vous ou proposez-vous/);
  assert.match(creator, /Comprendre ma demande/); assert.match(creator, /Saisir manuellement/); assert.match(creator, /Nous avons compris/); assert.match(creator, /Créer le brouillon/);
  assert.match(creator, /role="status"/); assert.match(creator, /type="radio"/); assert.match(creator, /sm:grid-cols/);
  assert.match(creator, /router\.push\(`\/opportunities\/\$\{encodeURIComponent\(body\.id\)\}`\)/);
  assert.match(creator, /Nous n’avons pas pu interpréter automatiquement votre demande\. Vous pouvez continuer manuellement\./);
  assert.doesNotMatch(`${page}\n${creator}`, /AITemplateDesigner|TemplateVersion|FormTemplate|RelationTemplate|KPI|OBJECTIF|BESOIN|MODALITÉS/);
});

test("owner destinations separate autonomous structured opportunities from legacy links", () => {
  const autonomous = { id: "new", templateId: null, rules: buildOpportunityRulesV1({}, { type: "NEED", criteria: { subject: "aide" } }) };
  assert.equal(opportunityOwnerHref(autonomous), "/opportunities/new");
  assert.equal(opportunityOwnerHref({ ...autonomous, id: "historic", templateId: "journey" }), "/links/historic");
  assert.equal(opportunityOwnerHref({ id: "legacy", templateId: "journey", rules: { creationSource: "opportunity" } }), "/links/legacy");
  assert.equal(opportunityOwnerHref({ id: "simple", templateId: null, rules: { simpleLink: true } }), "/links/simple");
});

test("the dedicated API never creates a governed technical object", () => {
  const route = read("app/api/opportunities/route.ts");
  const interpretation = read("app/api/opportunities/interpret/route.ts");
  for (const model of ["relationTemplate", "templateVersion", "formTemplate", "formField", "templateGeneration"]) assert.doesNotMatch(route, new RegExp(`prisma\\.${model}\\.(create|update|upsert)`));
  assert.match(route, /prisma\.gLink\.create/);
  assert.doesNotMatch(interpretation, /prisma|recordAIEvent|\.create\(/);
});
