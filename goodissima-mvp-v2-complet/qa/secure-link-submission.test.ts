import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { canSubmitToGLink } from "../lib/secure-link-submission.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

const now = new Date("2026-09-11T12:00:00.000Z");

test("allows only active links with no expiration or a future expiration", () => {
  assert.equal(canSubmitToGLink({ status: "ACTIVE", expiresAt: null }, now), true);
  assert.equal(canSubmitToGLink({ status: "ACTIVE", expiresAt: new Date(now.getTime() + 1) }, now), true);
});

test("rejects elapsed boundaries and every inactive status", () => {
  assert.equal(canSubmitToGLink({ status: "ACTIVE", expiresAt: new Date(now.getTime() - 1) }, now), false);
  assert.equal(canSubmitToGLink({ status: "ACTIVE", expiresAt: now }, now), false);
  for (const status of ["DISABLED", "EXPIRED", "ARCHIVED", "DRAFT"]) {
    assert.equal(canSubmitToGLink({ status, expiresAt: null }, now), false);
  }
});

test("the real route refuses unavailable links before every persistence or external effect", async () => {
  const file = "app/api/cases/route.ts";
  const imports = Object.fromEntries(ts.preProcessFile(readFileSync(file, "utf8")).importedFiles.map((item) => [item.fileName, {}]));
  const effects: string[] = [];

  for (const link of [
    { status: "DISABLED", expiresAt: null },
    { status: "EXPIRED", expiresAt: null },
    { status: "ARCHIVED", expiresAt: null },
    { status: "ACTIVE", expiresAt: new Date(0) },
  ]) {
    effects.length = 0;
    const prisma = new Proxy({
      gLink: { findUnique: async () => ({ id: "link", rules: {}, admissionMode: "OPEN", owner: {}, ...link }) },
    } as Record<string, unknown>, {
      get(target, property) {
        if (property in target) return target[property as string];
        effects.push(`prisma.${String(property)}`);
        return new Proxy({}, { get: (_unused, operation) => async () => effects.push(`prisma.${String(property)}.${String(operation)}`) });
      },
    });
    const route = loadTestModule<any>(file, {
      ...imports,
      "@/lib/prisma": { prisma },
      "@/lib/secure-link-submission": { canSubmitToGLink },
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    }, {
      console: { warn() {}, error() {}, info() {} },
    });
    const response = await route.POST({ json: async () => ({ gLinkId: "link" }) });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Link not found", code: "GLINK_NOT_FOUND", reasons: ["gLink_not_found"] });
    assert.deepEqual(effects, []);
  }
});

test("the guard precedes form, admission, identity, persistence and notification work", () => {
  const source = readFileSync(new URL("../app/api/cases/route.ts", import.meta.url), "utf8");
  const guard = source.indexOf("if (!canSubmitToGLink(gLink, submissionNow))");
  assert.ok(guard > source.indexOf("if (!gLink)"));
  for (const later of ["const simpleLinkSubmission", "await observeTrustAdmissionToken", "tx.relationCase.create", "await createFormSubmission", "await sendNewRelationCaseEmail"]) {
    assert.ok(source.indexOf(later, guard) > guard, `${later} must remain after the availability guard`);
  }
});
