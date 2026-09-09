import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { renderShellFixture } from "./helpers/render-connected-shell.ts";
import * as spatial from "../lib/spatial-navigation.ts";

const common = { "react/jsx-runtime": jsx, "next/link": ({ children, prefetch: _, ...props }: any) => jsx.jsx("a", { ...props, children }) };
const list = loadTestModule("components/FactualAttentionList.tsx", common);
const home = loadTestModule("components/DashboardHome.tsx", { ...common, "@/components/FactualAttentionList": list });
function repository(rows: any[] = []) {
  const calls: any[] = [];
  const module = loadTestModule("lib/factual-attention.ts", { "@/lib/spatial-navigation": spatial, "@/lib/prisma": { prisma: { relationCase: {
    findMany: async (q: any) => {
      calls.push(q);
      return rows.filter(r => r.ownerId === q.where.ownerId && q.where.status.in.includes(r.status) && r.governanceStatus === q.where.governanceStatus && r.closedAt === q.where.closedAt)
        .sort((a,b) => a.id.localeCompare(b.id)).slice(q.skip, q.skip + q.take);
    },
  } } } });
  return { ...module, calls };
}
const row = (id: string, extra = {}) => ({ id, candidateName: "Dossier <test>", ownerId: "A", status: "WAITING_OWNER", governanceStatus: "ACTIVE", closedAt: null, ...extra });

test("only explicit owner attention states on active non-closed cases become alerts", async () => {
  const r = repository([row("waiting"), row("review", { status: "REVIEWING" }), row("foreign", { ownerId: "B" }),
    ...["NEW", "WAITING_CANDIDATE", "VALIDATED", "REJECTED", "CLOSED", "ARCHIVED"].map(status => row(status, { status, priority: "URGENT", workspaceId: null, createdAt: new Date(0) })),
    ...["SUSPENDED", "CLOSED", "BLOCKED"].map(governanceStatus => row(governanceStatus, { governanceStatus })), row("closed", { closedAt: new Date() })]);
  const result = await r.getFactualAttention("A");
  assert.deepEqual(result.items.map((a: any) => a.type), ["REVIEWING", "WAITING_OWNER"]);
  assert.equal(result.items[0].reason, "Ce dossier est marqué « À vérifier ».");
  assert.equal(result.items[1].reason, "Ce dossier est marqué « En attente propriétaire ».");
  assert.equal(r.calls.length, 1);
  assert.deepEqual(r.calls[0], { where: { ownerId: "A", status: { in: ["WAITING_OWNER", "REVIEWING"] }, governanceStatus: "ACTIVE", closedAt: null }, orderBy: { id: "asc" }, skip: 0, take: 21, select: { id: true, candidateName: true, status: true } });
  assert.equal((await r.getFactualAttention("B")).items[0].id, "foreign");
  await assert.rejects(r.getFactualAttention(""), /Authenticated/);
});

test("Workspace absence, age, priority and AI suggestions are not alert evidence", async () => {
  const r = repository([row("unassigned", { workspaceId: null }), row("assigned", { workspaceId: "w" }), row("false", { status: "NEW", workspaceId: null, priority: "URGENT", createdAt: new Date(0), aiSuggestion: "Late" })]);
  assert.deepEqual((await r.getFactualAttention("A")).items.map((a: any) => a.id), ["assigned", "unassigned"]);
  const source = readFileSync("lib/factual-attention.ts", "utf8");
  assert.doesNotMatch(source, /createdAt:|workspaceId:|priority:|getGovernancePilotage|matching|\$queryRaw/);
});

test("preview is exactly the first three full-page results; pagination is bounded", async () => {
  const r = repository(Array.from({ length: 25 }, (_, i) => row(`r${String(i).padStart(2, "0")}`)));
  const full = await r.getFactualAttention("A");
  const preview = await r.getFactualAttention("A", 0, 3);
  assert.deepEqual(preview.items, full.items.slice(0, 3));
  assert.equal(preview.hasMore, true); assert.equal(full.hasMore, true);
  assert.equal((await r.getFactualAttention("A", 1)).items.length, 5);
  assert.deepEqual(r.calls.map((q: any) => [q.take, q.skip]), [[21, 0], [4, 0], [21, 20]]);
  for (const value of ["-1", ["2"], "100000", "invalid"]) assert.equal(r.attentionPage(value), 0);
});

test("destinations are internal and output contains no source tokens, emails, priority or dates", async () => {
  const r = repository([row("case-1", { candidateName: "https://host/secure/token", candidateEmail: "secret@example.test", candidateAccessToken: "secret" })]);
  const alert = (await r.getFactualAttention("A")).items[0];
  assert.equal(alert.label, "Dossier"); assert.equal(alert.href, "/cases/case-1");
  assert.deepEqual(Object.keys(alert).sort(), ["href", "id", "label", "object", "reason", "type"]);
  const destination = readFileSync("app/(connected)/cases/[caseId]/page.tsx", "utf8");
  assert.match(destination, /where: \{ id: params.caseId, ownerId: owner.id \}/);
});

test("both pages authenticate before the same projection, never using request owner IDs", async () => {
  const r = repository(); let authenticated = false; const calls: any[] = [];
  const dependencies = { ...common, "next/cache": { unstable_noStore() {} },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!authenticated) throw Error("LOGIN"); return { id: "session-owner" }; } },
    "@/lib/factual-attention": { attentionPage: r.attentionPage, getFactualAttention: async (...args: any[]) => { calls.push(args); return { items: [], hasMore: false }; } },
    "@/components/FactualAttentionList": list, "@/components/DashboardHome": home,
    "@/lib/dashboard-activity-repository": { getDashboardActivity: async () => [] },
  };
  const alerts = loadTestModule("app/(connected)/alertes/page.tsx", dependencies).default;
  const dashboard = loadTestModule("app/(connected)/dashboard/page.tsx", dependencies).default;
  await assert.rejects(alerts({ searchParams: {} }), /LOGIN/); await assert.rejects(dashboard(), /LOGIN/); assert.equal(calls.length, 0);
  authenticated = true;
  const page = renderToStaticMarkup(await alerts({ searchParams: { ownerId: "foreign" } }));
  const preview = renderToStaticMarkup(await dashboard());
  assert.deepEqual(calls, [["session-owner", 0], ["session-owner", 0, 3]]);
  for (const html of [page, preview]) assert.match(html, /Rien ne nécessite actuellement votre attention\./);
});

test("home preview follows the doors; Bien démarrer changes only the home door", async () => {
  const attention = await repository([row("c")]).getFactualAttention("A");
  const html = renderToStaticMarkup(jsx.jsx(home.DashboardHome, { activity: [], attention }));
  assert.ok(html.indexOf("À votre attention") > html.indexOf("</nav>"));
  assert.match(html, /Voir toutes/); assert.match(html, /href="\/alertes"/); assert.match(html, /Dossier &lt;test&gt;/);
  assert.match(html, /Bien démarrer/); assert.match(html, /data-boussole-id="open-boussole-from-dashboard" href="\/boussole\/decouverte"/);
  assert.doesNotMatch(html, /rouge|retard|SLA|Favoris/);
  assert.match(renderShellFixture(), /Boussole/); assert.doesNotMatch(renderShellFixture(), /Bien démarrer/);
  assert.equal(spatial.isConnectedPathname("/alertes"), true);
});

test("alerts page renders factual reasons, safe links and pagination without a global counter", async () => {
  const r = repository(Array.from({ length: 22 }, (_, i) => row(`case-${String(i).padStart(2, "0")}`)));
  const page = loadTestModule("app/(connected)/alertes/page.tsx", { ...common,
    "next/cache": { unstable_noStore() {} }, "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "A" }) },
    "@/lib/factual-attention": r, "@/components/FactualAttentionList": list,
  });
  const first = renderToStaticMarkup(await page.default({ searchParams: {} }));
  assert.match(first, /Alertes Goodissima/); assert.match(first, /En attente propriétaire/);
  assert.match(first, /href="\/alertes\?page=1"/);
  assert.equal((first.match(/href="\/cases\//g) ?? []).length, 20);
  assert.doesNotMatch(first, /Rien ne nécessite|<time|badge|22 alertes/);
  const second = renderToStaticMarkup(await page.default({ searchParams: { page: "1" } }));
  assert.match(second, /Précédent/); assert.doesNotMatch(second, /Suivant/);
  const beyond = renderToStaticMarkup(await page.default({ searchParams: { page: "2" } }));
  assert.match(beyond, /Aucun élément sur cette page/); assert.doesNotMatch(beyond, /Rien ne nécessite/);
});
