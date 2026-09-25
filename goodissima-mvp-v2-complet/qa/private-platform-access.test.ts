import test from "node:test";
import assert from "node:assert/strict";
import { canManagePrivatePlatformAccess } from "../lib/private-platform-access.ts";
import { readFileSync } from "node:fs";

test("private platform access is limited to actual administrative roles", () => {
  assert.equal(canManagePrivatePlatformAccess({ role: "ADMIN" }), true);
  assert.equal(canManagePrivatePlatformAccess({ role: "SUPER_ADMIN" }), true);
  for (const role of ["OWNER", "PRODUCT_OWNER", "TESTER", "MEMBER", null]) {
    assert.equal(canManagePrivatePlatformAccess({ role }), false);
  }
});

test("private access API and settings use the same server policy", () => {
  const route = readFileSync("app/api/access-invitations/route.ts", "utf8");
  const revoke = readFileSync("app/api/access-invitations/[invitationId]/revoke/route.ts", "utf8");
  const settings = readFileSync("app/(connected)/settings/page.tsx", "utf8");
  for (const source of [route, revoke, settings]) assert.match(source, /canManagePrivatePlatformAccess/);
  assert.match(route, /status: 403/);
  assert.match(revoke, /status: 403/);
  assert.match(settings, /canManagePrivateAccess \? prisma\.accessInvitation\.findMany/);
});
