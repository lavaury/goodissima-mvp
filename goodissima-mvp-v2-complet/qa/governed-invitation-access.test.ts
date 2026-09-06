import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { hashJourneyInvitationToken } from "../lib/governed-journey-invitations.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
const token = "fixture-guest-token";

function middlewareWithSession(connected: boolean) {
  let authCalls = 0;
  const { updateSession } = loadTestModule("lib/supabase/middleware.ts", {
    "next/server": { NextResponse },
    "@supabase/ssr": { createServerClient: () => ({ auth: { getUser: async () => {
      authCalls += 1;
      return { data: { user: connected ? { id: "fixture-owner" } : null } };
    } } }) },
  });
  const { middleware } = loadTestModule("middleware.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/middleware": { updateSession },
    "@/lib/secure-trace": { secureTrace() {}, secureTraceEnvironment: () => "test" },
  });
  return { middleware, authCalls: () => authCalls };
}

function guestPage(state: "valid" | "revoked" | "expired" | "inactive" | "unknown", meetings: any[] = []) {
  const updates: any[] = [];
  const participationQueries: any[] = [];
  const invitation = state === "unknown" ? null : {
    id: "invitation-fixture", displayName: "Test Guest", role: "OBSERVER", metadata: {},
    relationTemplateId: "journey-fixture", relationTemplate: { name: "Fixture journey", description: "Test only" },
    status: state === "inactive" ? "REVOKED" : "ACTIVE",
    revokedAt: state === "revoked" ? new Date() : null,
    accessTokenExpiresAt: new Date(Date.now() + (state === "expired" ? -60_000 : 60_000)),
    acceptedAt: null,
  };
  const { default: page } = loadTestModule("app/gouvernance/invitation/[token]/page.tsx", {
    "react/jsx-runtime": jsx,
    "next/navigation": { notFound: () => { throw new Error("NEXT_NOT_FOUND"); } },
    "@/components/GovernedInvitationStatusRefresh": { GovernedInvitationStatusRefresh: () => null },
    "@/components/RelationLiveKitMediaRoom": { RelationLiveKitMediaRoom: (props: any) => {
      assert.equal(props.actorKind, "guest");
      assert.equal(props.guestAccessToken, token);
      return jsx.jsx("button", { children: props.joinLabel });
    } },
    "@/lib/governed-invitation-role-label": { getGovernedInvitationRoleLabel: () => "Observateur" },
    "@/lib/governed-journey-invitations": { hashJourneyInvitationToken },
    "@/lib/prisma": { prisma: {
      governedJourneyInvitation: {
        findUnique: async (query: any) => {
          assert.equal(query.where.accessTokenHash, hashJourneyInvitationToken(token));
          return invitation;
        },
        update: async (query: any) => { updates.push(query); return invitation; },
      },
      governedMeetingParticipant: { findMany: async (query: any) => { participationQueries.push(query); return meetings; } },
    } },
  });
  return { page, updates, participationQueries };
}

for (const connected of [false, true]) {
  test(`valid guest invitation reaches token validation with ${connected ? "an owner session" : "no session"}`, async () => {
    const access = middlewareWithSession(connected);
    for (const suffix of ["", "/", "?next=/dashboard"]) {
      const response = await access.middleware(new NextRequest(`https://test.invalid/gouvernance/invitation/${token}${suffix}`));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("x-middleware-next"), "1");
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    }
    assert.equal(access.authCalls(), 0, "guest page does not depend on owner session lookup");

    const fixture = guestPage("valid");
    const html = renderToStaticMarkup(await fixture.page({ params: { token } }));
    assert.match(html, /acces invite limite/);
    assert.doesNotMatch(html, /Navigation principale|href="\/(?:dashboard|settings|administration|gouvernance)/);
    assert.equal(getCompassContext(`/gouvernance/invitation/${token}`), null);
    assert.equal(getCompassContext(`/gouvernance/invitation/${token}/`), null);
    assert.equal(fixture.updates.length, 1);
    assert.ok(fixture.updates[0].data.acceptedAt instanceof Date);
    assert.ok(fixture.updates[0].data.lastAccessedAt instanceof Date);
    assert.deepEqual(fixture.participationQueries[0].where, {
      governedJourneyInvitationId: "invitation-fixture", status: "AUTHORIZED",
      communicationSession: { relationTemplateId: "journey-fixture", relationCaseId: null },
    });
  });
}

for (const state of ["revoked", "expired", "inactive", "unknown"] as const) {
  test(`${state} token is refused by the real page without consultation writes`, async () => {
    const { middleware } = middlewareWithSession(false);
    const response = await middleware(new NextRequest(`https://test.invalid/gouvernance/invitation/${token}`));
    assert.equal(response.status, 200, "middleware delegates token validation to the page");
    const fixture = guestPage(state);
    if (state === "unknown") {
      await assert.rejects(fixture.page({ params: { token } }), /NEXT_NOT_FOUND/);
    } else {
      assert.match(renderToStaticMarkup(await fixture.page({ params: { token } })), /Acces refuse/);
    }
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.participationQueries.length, 0);
  });
}

test("only the invitation leaf bypasses authentication; other governance paths retain next and protection", async () => {
  const { middleware } = middlewareWithSession(false);
  for (const route of [
    "/gouvernance", "/gouvernance/nouveau", "/gouvernance/pilotage", "/gouvernance/portfolios",
    "/gouvernance/portfolios/fixture", "/gouvernance/workspaces/nouveau",
    "/gouvernance/parcours/fixture/pilotage", "/gouvernance/invitation", "/gouvernance/invitation/",
    "/gouvernance/invitation/token/extra", "/gouvernance/invitations/token", "/gouvernance/invitation-other/token",
  ]) {
    const response = await middleware(new NextRequest(`https://test.invalid${route}?view=active`));
    assert.equal(response.status, 307, route);
    const redirect = new URL(response.headers.get("location")!);
    assert.match(redirect.pathname, /^\/login\/?$/);
    assert.equal(redirect.searchParams.get("next"), `${route}?view=active`);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  }
  assert.equal(getCompassContext("/gouvernance")?.id, "governance");
});

test("existing secure-candidate bypass and authenticated login redirect are unchanged", async () => {
  const candidate = middlewareWithSession(false);
  assert.equal((await candidate.middleware(new NextRequest(`https://test.invalid/secure/${token}`))).status, 200);
  assert.equal(candidate.authCalls(), 0);
  const owner = middlewareWithSession(true);
  const response = await owner.middleware(new NextRequest("https://test.invalid/login?next=/settings"));
  assert.equal(response.headers.get("location"), "https://test.invalid/dashboard");
});

test("guest page exposes media only for an open, unexpired authorized meeting", async () => {
  const live = { id: "meeting-fixture", title: "Fixture meeting", purpose: "Test", status: "REQUESTED",
    provider: "LIVEKIT_PENDING", accessOpened: true, expiresAt: new Date(Date.now() + 60_000) };
  for (const [session, canJoin] of [
    [live, true], [{ ...live, accessOpened: false }, false],
    [{ ...live, status: "COMPLETED" }, false], [{ ...live, expiresAt: new Date(0) }, false],
  ] as const) {
    const fixture = guestPage("valid", [{ communicationSession: session }]);
    const html = renderToStaticMarkup(await fixture.page({ params: { token } }));
    assert.equal(html.includes("Rejoindre la salle securisee"), canJoin);
  }
});
