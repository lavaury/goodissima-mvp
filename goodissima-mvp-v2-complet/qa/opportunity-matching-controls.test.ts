import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as projection from "../lib/opportunities/opportunity-projection.ts";
import * as contracts from "../lib/opportunities/contracts.ts";

const criteria = { subject: "Cours d’anglais", locations: ["Beauvais"] };
const validRules = projection.buildOpportunityRulesV1({ retained: "KEEP" }, { type: "OFFER", criteria });
const request = (body: unknown) => ({ json: async () => body });
const row = (status = "ACTIVE", rules: unknown = validRules) => ({ id: "opp", slug: "cours", ownerId: "owner", status, templateId: null, rules });
function setup(value: any, ownerId = "owner") {
  const writes: any[] = [];
  const route = loadTestModule<any>("app/api/opportunities/[id]/matching/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: ownerId }) },
    "@/lib/prisma": { prisma: { gLink: { findFirst: async ({ where }: any) => value && value.id === where.id && value.ownerId === where.ownerId ? value : null, update: async (input: any) => { writes.push(input); return input; } } } },
    "@/lib/opportunities/opportunity-projection": projection,
    "@/lib/opportunities/contracts": contracts,
  });
  return { route, writes };
}

test("owner can explicitly enable and disable matching while preserving every other rule", async () => {
  const enabled = setup(row());
  const response = await enabled.route.PATCH(request({ enabled: true }), { params: { id: "opp" } });
  assert.equal(response.status, 200); assert.equal(enabled.writes.length, 1);
  assert.deepEqual(enabled.writes[0].data.rules, { ...validRules, opportunity: { ...(validRules as any).opportunity, matchingEnabled: true } });
  assert.equal(enabled.writes[0].data.status, undefined);
  const disabled = setup(row("ACTIVE", enabled.writes[0].data.rules));
  assert.equal((await disabled.route.PATCH(request({ enabled: false }), { params: { id: "opp" } })).status, 200);
  assert.equal(disabled.writes[0].data.rules.opportunity.matchingEnabled, false);
});

test("activation is ACTIVE-only, owner-scoped and strictly typed", async () => {
  for (const status of ["DRAFT", "DISABLED", "EXPIRED", "ARCHIVED"]) assert.equal((await setup(row(status)).route.PATCH(request({ enabled: true }), { params: { id: "opp" } })).status, 409);
  assert.equal((await setup(row(), "other").route.PATCH(request({ enabled: true }), { params: { id: "opp" } })).status, 404);
  for (const rules of [{ simpleLink: true }, { creationSource: "opportunity" }, {}, { creationSource: "opportunity", opportunity: {} }]) assert.equal((await setup(row("ACTIVE", rules)).route.PATCH(request({ enabled: true }), { params: { id: "opp" } })).status, 409);
  for (const body of [{}, { enabled: true, extra: true }, { enabled: "true" }, null]) assert.equal((await setup(row()).route.PATCH(request(body), { params: { id: "opp" } })).status, 400);
});

test("disabling remains possible off-line without changing publication lifecycle", async () => {
  for (const status of ["ACTIVE", "DISABLED", "EXPIRED", "ARCHIVED"]) { const value = setup(row(status, projection.buildOpportunityRulesV1({}, { type: "OFFER", criteria, matchingEnabled: true }))); const response = await value.route.PATCH(request({ enabled: false }), { params: { id: "opp" } }); assert.equal(response.status, 200); assert.equal(value.writes[0].data.status, undefined); }
});

test("owner UI separates publication from matching and uses an accessible confirmation", () => {
  const component = readFileSync(new URL("../components/OpportunityMatchingControls.tsx", import.meta.url), "utf8");
  for (const copy of ["Matching désactivé", "Matching activé", "Activer le matching", "Suspendre le matching", "Matching inactif", "L’opportunité restera publiée et son lien public restera accessible"]) assert.ok(component.includes(copy));
  for (const contract of ['role="dialog"', 'aria-modal="true"', 'event.key === "Escape"', 'event.key === "Tab"', "confirmation === \"enable\""]) assert.ok(component.includes(contract));
  assert.doesNotMatch(component, /MatchingRun|MatchingResult|targetGLinkId|Lancer une analyse|Retenir|Écarter|fetch\([^]*\/matching[^]*POST/);
});
