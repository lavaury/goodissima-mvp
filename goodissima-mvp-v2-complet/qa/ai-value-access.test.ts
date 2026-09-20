import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { canAccessAIValue } from "../lib/ai-value-access.ts";
import { canAccessFeedbackAdmin } from "../lib/product-feedback.ts";
import { canAccessChampagneWorkspace } from "../lib/champagne-workspace.ts";

const access = { canAccessAIValue };
const denied = ["OWNER", "TESTER", "PRODUCT_OWNER", "USER", "admin", "", null, undefined];
const Link = ({ children, ...props }: any) => jsx.jsx("a", { ...props, children });
const common: any = { "react/jsx-runtime": jsx, "next/link": Link, "@/lib/ai-value-access": access };
const nullComponent = () => null;
test("AI value grants only the two exact roles; Feedback and Champagne remain independent", () => {
  for (const role of ["ADMIN", "SUPER_ADMIN"]) assert.equal(canAccessAIValue(role), true);
  for (const role of denied) assert.equal(canAccessAIValue(role), false);
  for (const role of ["ADMIN", "SUPER_ADMIN", "PRODUCT_OWNER"]) assert.equal(canAccessFeedbackAdmin(role), true);
  assert.equal(canAccessFeedbackAdmin("TESTER"), false);
  for (const role of ["ADMIN", "SUPER_ADMIN", "PRODUCT_OWNER", "TESTER"]) assert.equal(canAccessChampagneWorkspace(role), true);
  assert.equal(canAccessChampagneWorkspace("OWNER"), false);
});

function entries(role: any) {
  let reads = 0;
  const deps = {
    ...common,
    "next/cache": { unstable_noStore() {} },
    "next/navigation": { notFound() { throw Error("NOT_FOUND"); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "u", role }) },
    "@/lib/ai/cost-data": {
      getOrganizationAICostEvents: async (id: string) => { assert.equal(id, "u"); reads++; return []; },
      getOrganizationAIValueActivity: async () => ({}),
      getOrganizationAIValueAnalyticsData: async () => ({ generations: [], optimizations: [], criticReports: [] }),
    },
    "@/lib/ai/cost-observability": loadTestModule("lib/ai/cost-observability.ts", {}),
    "@/lib/ai/value-analytics": loadTestModule("lib/ai/value-analytics.ts", {}),
    "@/config/ai-value-estimation": loadTestModule("config/ai-value-estimation.ts", {}),
    ...Object.fromEntries(["AICostTrendChart", "AIValueTrendChart", "ActiveOrganizationBadge", "DashboardBackLink"].map(n => ["@/components/" + n, { [n]: nullComponent }])),
  };
  const page = loadTestModule("app/(connected)/admin/ai-costs/page.tsx", deps);
  const alias = loadTestModule("app/(connected)/ia-valeur/page.tsx", { "@/app/(connected)/admin/ai-costs/page": page });
  return { page, alias, api: loadTestModule("app/api/admin/ai-costs/export/route.ts", deps), reads: () => reads };
}
test("direct canonical URL, alias and export refuse before data access", async () => {
  for (const role of denied) {
    const e = entries(role);
    await assert.rejects(e.page.default({}), /NOT_FOUND/);
    await assert.rejects(e.alias.default({}), /NOT_FOUND/);
    const response = await e.api.GET(new Request("https://example.test/api/admin/ai-costs/export"));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(e.reads(), 0);
  }
});
test("both authorized roles can open both pages and export", async () => {
  for (const role of ["ADMIN", "SUPER_ADMIN"]) {
    const e = entries(role);
    assert.ok(await e.page.default({}));
    assert.ok(await e.alias.default({}));
    const response = await e.api.GET(new Request("https://example.test/api/admin/ai-costs/export"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type")!, /text\/csv/);
    assert.equal(e.reads(), 3);
  }
});
test("user navigation fails closed and shows the link only with server permission", () => {
  const { PlatformNavigation } = loadTestModule("components/PlatformNavigation.tsx", {
    ...common, react: React, "next/navigation": { usePathname: () => "/dashboard" },
    ...Object.fromEntries(["ActiveOrganizationBadge", "LanguageSwitcher", "LogoutButton"].map(n => ["@/components/" + n, { [n]: nullComponent }])),
  });
  for (const aiValueAllowed of [undefined, false, true]) {
    const html = renderToStaticMarkup(jsx.jsx(PlatformNavigation, { aiValueAllowed }));
    assert.equal(html.includes('href="/ia-valeur"'), aiValueAllowed === true);
  }
});
test("Administration hides both AI entry links independently of Feedback and Champagne", async () => {
  for (const role of ["ADMIN", "SUPER_ADMIN", ...denied]) {
    const page = loadTestModule("app/(connected)/administration/page.tsx", {
      ...common, "@/lib/auth": { getCurrentPrismaUser: async () => ({ role }) },
      "@/lib/champagne-workspace": { canAccessChampagneWorkspace },
      "@/lib/product-feedback": { canAccessFeedbackAdmin },
      "@/lib/debug": { isDemoSurfaceEnabled: () => false },
      "@/components/ChampagneScenariosPanel": { ChampagneScenariosPanel: nullComponent },
      "@/components/DashboardBackLink": { DashboardBackLink: nullComponent },
    });
    const html = renderToStaticMarkup(await page.default());
    for (const href of ["/ia-valeur", "/admin/ai-costs"]) assert.equal(html.includes('href="' + href + '"'), canAccessAIValue(role));
    assert.equal(html.includes('href="/administration/feedback"'), canAccessFeedbackAdmin(role));
    assert.equal(html.includes('id="tests-champagne"'), canAccessChampagneWorkspace(role));
  }
});
test("shell permission uses database role, never client metadata; missing user fails closed", async () => {
  for (const role of ["ADMIN", "SUPER_ADMIN", ...denied]) {
    const layout = loadTestModule("app/(connected)/layout.tsx", {
      ...common, "next/cache": { unstable_noStore() {} },
      "@/lib/auth": { requireCurrentUser: async () => ({ email: "u@example.test", user_metadata: { role: "SUPER_ADMIN" } }) },
      "@/lib/access-invitations": { normalizeInvitationEmail: (s: string) => s },
      "@/lib/prisma": { prisma: { user: { findUnique: async (q: any) => {
        assert.deepEqual(q, { where: { email: "u@example.test" }, select: { role: true } });
        return role === undefined ? null : { role };
      } } } },
      "@/components/ConnectedShell": { ConnectedShell: nullComponent },
    });
    const element = await layout.default({ children: null });
    assert.equal(element.props.aiValueAllowed, canAccessAIValue(role));
  }
});
