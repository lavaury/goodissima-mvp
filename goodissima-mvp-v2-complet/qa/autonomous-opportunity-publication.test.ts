import assert from "node:assert/strict";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as lifecycle from "../lib/link-lifecycle.ts";
import * as projection from "../lib/opportunities/opportunity-projection.ts";
import * as contracts from "../lib/opportunities/contracts.ts";

const validRules = projection.buildOpportunityRulesV1({}, { type: "NEED", criteria: { subject: "baby-sitter", locations: ["Beauvais"] } });
function setup(row: any, ownerId = "owner") {
  const writes: any[] = []; const invalidated: string[] = [];
  const route = loadTestModule<any>("app/api/opportunities/[id]/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "next/cache": { revalidatePath: (path: string) => invalidated.push(path) },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: ownerId }) },
    "@/lib/prisma": { prisma: { gLink: { findFirst: async ({ where }: any) => row && row.id === where.id && row.ownerId === where.ownerId ? row : null, update: async (value: any) => { writes.push(value); return { ...row, ...value.data }; } } } },
    "@/lib/link-lifecycle": lifecycle, "@/lib/opportunities/opportunity-projection": projection, "@/lib/opportunities/contracts": contracts,
  });
  return { route, writes, invalidated };
}
const request = (body: unknown) => ({ json: async () => body });
const row = (status = "DRAFT", extra = {}) => ({ id: "opp", slug: "baby", ownerId: "owner", status, expiresAt: null, templateId: null, rules: validRules, ...extra });

test("publishes only an owned valid autonomous DRAFT through central lifecycle", async () => {
  const s = setup(row()); const response = await s.route.PATCH(request({ action: "publish" }), { params: { id: "opp" } });
  assert.equal(response.status, 200); assert.equal(s.writes[0].data.status, "ACTIVE"); assert.ok(s.invalidated.includes("/l/baby"));
  assert.equal((await setup(row(), "other").route.PATCH(request({ action: "publish" }), { params: { id: "opp" } })).status, 404);
  assert.equal((await setup(row("DRAFT", { rules: { creationSource: "opportunity", opportunity: {} } })).route.PATCH(request({ action: "publish" }), { params: { id: "opp" } })).status, 409);
});

test("refuses expired and terminal publication and supports suspend, resume and archive", async () => {
  assert.equal((await setup(row("DRAFT", { expiresAt: new Date("2020-01-01") })).route.PATCH(request({ action: "publish" }), { params: { id: "opp" } })).status, 409);
  for (const status of ["ARCHIVED", "EXPIRED"]) assert.equal((await setup(row(status)).route.PATCH(request({ action: "publish" }), { params: { id: "opp" } })).status, 409);
  for (const [status, action, target] of [["ACTIVE", "suspend", "DISABLED"], ["DISABLED", "resume", "ACTIVE"], ["DRAFT", "archive", "ARCHIVED"]] as const) { const s = setup(row(status)); assert.equal((await s.route.PATCH(request({ action }), { params: { id: "opp" } })).status, 200); assert.equal(s.writes[0].data.status, target); }
});

test("draft editing validates structured metadata and active editing stays textual", async () => {
  const s = setup(row()); const response = await s.route.PATCH(request({ action: "update", title: "Nouveau", description: "Texte", type: "NEED", criteria: { subject: "garde", locations: ["Beauvais"] }, expiresAt: "2030-01-01" }), { params: { id: "opp" } });
  assert.equal(response.status, 200); assert.equal(s.writes[0].data.city, "Beauvais"); assert.equal(s.writes[0].data.rules.opportunity.criteria.subject, "garde");
  assert.equal((await setup(row()).route.PATCH(request({ action: "update", title: "X", description: "", type: "NEED", criteria: { subject: "" }, expiresAt: null }), { params: { id: "opp" } })).status, 400);
  const active = setup(row("ACTIVE")); assert.equal((await active.route.PATCH(request({ action: "update", title: "Titre", description: "Description", type: "OFFER", criteria: { subject: "changé" }, expiresAt: null }), { params: { id: "opp" } })).status, 200); assert.equal(active.writes[0].data.rules, undefined);
});
