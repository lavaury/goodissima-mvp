import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as attention from "../lib/governance-attention.ts";
import * as matching from "../lib/glink-matching.ts";
import * as spatial from "../lib/spatial-navigation.ts";

const now = new Date("2026-09-06T12:00:00Z");
const tomorrow = new Date("2026-09-07T12:00:00Z");
const old = new Date("2026-08-01T12:00:00Z");
// In-memory relational adapter applies the actual Prisma predicates, including nested includes.
// No production database or provider is used; the deterministic engine itself is real.
function matches(row: any, where: any): boolean {
  return !where || Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((branch: any) => matches(row, branch));
    if (value === null || typeof value !== "object" || value instanceof Date) return row[key] === value;
    if ("notIn" in value) return !value.notIn.includes(row[key]);
    if ("gt" in value || "gte" in value || "lte" in value) return row[key] != null && (!value.gt || row[key] > value.gt) && (!value.gte || row[key] >= value.gte) && (!value.lte || row[key] <= value.lte);
    return row[key] != null && matches(row[key], value);
  });
}
function setup() {
  const workspaces = [{ id: "a1", ownerId: "a", name: "Homonyme", status: "ACTIVE", portfolioId: null, portfolio: null },
    { id: "a2", ownerId: "a", name: "Homonyme", status: "ACTIVE", portfolioId: null, portfolio: null },
    { id: "b1", ownerId: "b", name: "Homonyme", status: "ACTIVE", portfolioId: null, portfolio: null }];
  const journeys = workspaces.map(w => ({ id: `j-${w.id}`, workspaceId: w.id, workspace: w, name: `Parcours ${w.id}`, status: "DRAFT", formTemplates: [{ id: `form-${w.id}` }], relationCases: [], links: [] }));
  const invitations = workspaces.map(w => ({ id: `invite-${w.id}`, workspaceId: w.id, ownerId: w.ownerId, relationTemplateId: `j-${w.id}`, displayName: `Invité ${w.id}`, status: "ACTIVE", acceptedAt: null, revokedAt: null, accessTokenExpiresAt: tomorrow, createdAt: now }));
  invitations.push({ ...invitations[0], id: "invite-foreign", ownerId: "b" });
  const links = workspaces.map(w => ({ id: `link-${w.id}`, ownerId: w.ownerId, workspaceId: w.id, workspace: w, status: "ACTIVE", title: `Lien ${w.id}`, description: "Critères utiles", rules: { matchingEnabled: true }, createdAt: now, templateId: `j-${w.id}`, template: { name: `Parcours ${w.id}`, formTemplates: [{ fields: [{ label: "Critère", type: "TEXT" }] }] } }));
  links.push({ ...links[0], id: "foreign-link", ownerId: "b" });
  const sessions: any[] = workspaces.map(w => ({ id: `session-${w.id}`, ownerId: w.ownerId, workspaceId: w.id, workspace: w, relationTemplateId: `j-${w.id}`, relationTemplate: journeys.find(j => j.workspaceId === w.id), relationCaseId: null, relationCase: null, title: `Réunion ${w.id}`, status: "PREPARED_NOT_STARTED", scheduledAt: tomorrow, expiresAt: null, createdAt: now, updatedAt: now, meetingParticipants: [], metadata: {} }));
  sessions.push({ ...sessions[0], id: "orphan", relationTemplateId: null, relationTemplate: null });
  sessions.push({ ...sessions[0], id: "indirect", workspaceId: null, workspace: null, relationCaseId: "indirect-case", relationCase: { id: "indirect-case", ownerId: "a", candidateName: "Indirect", gLink: links[0] } });
  sessions.push({ ...sessions[0], id: "foreign-session", ownerId: "b" });
  sessions.push({ ...sessions[0], id: "past", scheduledAt: old, updatedAt: old, createdAt: old });
  sessions.push({ ...sessions[0], id: "cancelled", status: "CANCELLED" });
  sessions.push({ ...sessions[0], id: "completed", status: "COMPLETED" });
  sessions.push({ ...sessions[0], id: "expired", expiresAt: old });
  const calls: any[] = [];
  const prisma = {
    workspace: { findMany: async (q: any) => { calls.push({ model: "workspace", q }); return workspaces.filter(w => matches(w, q.where)).map(w => ({ ...w,
      relationTemplates: journeys.filter(j => j.workspaceId === w.id && matches(j, q.include.relationTemplates.where)).map(j => ({ ...j,
        governedJourneyInvitations: invitations.filter(i => i.relationTemplateId === j.id && matches(i, q.include.relationTemplates.include.governedJourneyInvitations.where)),
        communicationSessions: sessions.filter(s => s.relationTemplateId === j.id && matches(s, q.include.relationTemplates.include.communicationSessions.where)),
      })),
    })); } },
    gLink: { findMany: async (q: any) => { calls.push({ model: "link", q }); return links.filter(l => matches(l, q.where)); } },
    communicationSession: { findMany: async (q: any) => { calls.push({ model: "session", q }); const sort = q.orderBy[0]; const field = Object.keys(sort)[0]; return sessions.filter(s => matches(s, q.where)).sort((a,b) => (a[field] - b[field]) * (sort[field] === "asc" ? 1 : -1)).slice(0, q.take); } },
  };
  const engine = loadTestModule("lib/governance-pilotage-repository.ts", {
    "@/lib/prisma": { prisma }, "@/lib/governance-attention": attention, "@/lib/glink-matching": matching,
    "@/lib/ai/relational-matching-source": { hasUsefulGLinkMatchingCriteria: () => true },
    "@/lib/matching/glink-matching-summary-repository": { getGLinkMatchingSummariesForOwner: async () => new Map() },
  });
  const repository = loadTestModule("lib/workspace-pilotage-repository.ts", { "@/lib/prisma": { prisma }, "@/lib/governance-attention": attention, "@/lib/governance-pilotage-repository": engine });
  return { read: (owner = "a", id = "a1") => repository.getWorkspacePilotage(owner, id, now), engine, sessions, journeys, invitations, calls, workspaces };
}
test("real engine includes direct signals and isolates same names, workspaces and owners", async () => {
  const s = setup(); const data = await s.read();
  assert.ok(data.signals.some((x: any) => x.id === "GLINK:link-a1:MATCHING_TO_ANALYZE"));
  assert.ok(data.signals.some((x: any) => x.id === "deliver-invite-a1"));
  assert.ok(data.signals.every((x: any) => x.workspaceId === "a1"));
  assert.ok(!JSON.stringify(data).includes("foreign") && !JSON.stringify(data).includes("Indirect"));
  assert.equal(data.signals.length, new Set(data.signals.map((x: any) => x.id)).size);
  assert.ok((await s.read("a", "a2")).signals.every((x: any) => x.workspaceId === "a2"));
  const forbidden = await s.read("a", "b1");
  assert.deepEqual(forbidden.signals, []); assert.deepEqual(forbidden.upcoming, []); assert.deepEqual(forbidden.recent, []);
  assert.ok((await s.read("b", "b1")).signals.length > 0);
});
test("meeting and recent queries are direct, limited, time-filtered and exclude GLINK associations", async () => {
  const s = setup(); const data = await s.read();
  assert.deepEqual(data.upcoming.map((x: any) => x.id).sort(), ["orphan", "session-a1"]);
  assert.ok(data.recent.some((x: any) => x.id === "session-a1"));
  assert.ok(data.recent.some((x: any) => x.id === "completed"));
  assert.ok(!data.recent.some((x: any) => ["indirect", "past", "session-a2", "session-b1", "foreign-session"].includes(x.id)));
  for (const { q } of s.calls.filter(c => c.model === "session")) {
    assert.equal(q.where.workspaceId, "a1"); assert.equal(q.where.ownerId, "a"); assert.equal(q.take, 10);
    assert.equal(q.select.metadata, undefined); assert.equal(q.select.externalUrl, undefined);
  }
  assert.equal(data.upcoming.find((x: any) => x.id === "orphan").href, null);
  assert.equal(data.upcoming.find((x: any) => x.id === "session-a1").href, "/gouvernance/parcours/form-a1/pilotage");
});
test("moving a journey never reassigns old meetings, communications or invitations", async () => {
  const s = setup(); const journey = s.journeys[0]; journey.workspaceId = "a2"; journey.workspace = s.workspaces[1];
  const origin = await s.read("a", "a1"); const destination = await s.read("a", "a2");
  assert.ok(origin.upcoming.some((x: any) => x.id === "session-a1"));
  assert.ok(origin.recent.some((x: any) => x.id === "session-a1"));
  assert.ok(!destination.upcoming.some((x: any) => x.id === "session-a1"));
  assert.ok(!destination.recent.some((x: any) => x.id === "session-a1"));
  assert.ok(!destination.signals.some((x: any) => x.id.includes("invite-a1") || x.id.includes("session-a1")));
});
test("recent list is capped and sorted; future timestamps are excluded", async () => {
  const s = setup();
  for (let i=0;i<20;i++) s.sessions.push({ ...s.sessions[0], id: `extra-${i}`, updatedAt: new Date(now.getTime()-i*1000) });
  s.sessions.push({ ...s.sessions[0], id: "future-update", updatedAt: tomorrow });
  const data = await s.read(); assert.equal(data.recent.length, 10);
  assert.ok(!data.recent.some((x: any) => x.id === "future-update"));
  assert.ok(data.recent.every((x: any, i: number) => !i || x.updatedAt <= data.recent[i-1].updatedAt));
});
test("expired and revoked direct accesses are retained, null membership and name-based absence are excluded", async () => {
  const s = setup();
  s.invitations.push({ ...s.invitations[0], id: "expired-access", accessTokenExpiresAt: old });
  s.invitations.push({ ...s.invitations[0], id: "revoked-access", revokedAt: old } as any);
  s.invitations.push({ ...s.invitations[0], id: "unassigned-access", workspaceId: null } as any);
  s.sessions[0].metadata = { selectedParticipants: [{ participantName: "Participant historique" }] };
  const data = await s.read();
  assert.ok(data.signals.some((x: any) => x.id === "expired-expired-access"));
  assert.ok(data.signals.some((x: any) => x.id === "revoked-revoked-access"));
  assert.ok(!data.signals.some((x: any) => x.id.includes("unassigned-access") || x.id.startsWith("missing-")));
});
test("global and Portfolio modes retain their unscoped engine contract", async () => {
  const s = setup(); const global = await s.engine.getGovernancePilotage("a", undefined, undefined, now);
  assert.equal(global.workspaces.length, 2);
  assert.ok(global.signals.some((x: any) => x.workspaceId === "a2"));
  assert.equal(s.calls[0].q.include.relationTemplates.include.communicationSessions.where, undefined);
  Object.assign(s.workspaces[0], { portfolioId: "p-a" });
  const portfolio = await s.engine.getGovernancePilotage("a", "p-a", undefined, now);
  assert.equal(portfolio.workspaces.length, 1);
  assert.equal(portfolio.workspaces[0].id, "a1");
});
const { WorkspacePilotageView } = loadTestModule("components/WorkspacePilotageView.tsx", { "react/jsx-runtime": jsx, "@/lib/spatial-navigation": spatial,
  "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }) });
test("rendered attention has context, destinations, structured sections, direct counters and no mutations", async () => {
  const data = await setup().read();
  const html = renderToStaticMarkup(jsx.jsx(WorkspacePilotageView, { data, counts: { journeys: 2, links: 3, cases: 4 } }));
  for (const text of ["À examiner", "Parcours : Parcours a1", "Lien : Lien a1", "Réunions à venir", "Communications récentes", "14 derniers jours", 'href="/links/link-a1#matching"', '2026-09-07T12:00:00.000Z']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("<form") && !html.includes("Assistant") && !html.includes("disponible prochainement"));
  assert.equal((html.match(/<h2 /g) ?? []).length, 4);
});
test("all three empty business states render", () => {
  const html = renderToStaticMarkup(jsx.jsx(WorkspacePilotageView, { data: { signals: [], attention: [], upcoming: [], recent: [] }, counts: { journeys: 0, links: 0, cases: 0 } }));
  for (const text of ["Aucun point ne nécessite votre attention dans ce Workspace.", "Aucune réunion à venir.", "Aucune communication récente."]) assert.ok(html.includes(text));
});
test("page loads Piloter only in the default view and derives volumes from direct Explorer data", async () => {
  let reads=0;
  const page=loadTestModule("app/(connected)/gouvernance/workspaces/[id]/page.tsx", { "react/jsx-runtime": jsx, "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "a" }) },
    "@/lib/workspace-detail-repository": { getWorkspaceDetail: async () => ({ id: "a1", relationTemplates: [1,2], links: [1], relationCases: [] }) },
    "@/lib/workspace-pilotage-repository": { getWorkspacePilotage: async (owner: string,id: string) => { assert.equal(owner,"a");assert.equal(id,"a1");reads++;return {}; } },
    "@/components/WorkspaceDetailView": { WorkspaceDetailView: () => null }, "@/components/WorkspacePilotageView": { WorkspacePilotageView },
  });
  const explorer=await page.default({ params: { id:"a1" }, searchParams: { view:"explorer" } });
  assert.equal(reads,0); assert.equal(explorer.props.pilotage,null);
  const piloter=await page.default({ params: { id:"a1" } });
  assert.equal(reads,1);assert.equal(piloter.props.explorer,false);
  assert.deepEqual(piloter.props.pilotage.props.counts,{journeys:2,links:1,cases:0});
});
