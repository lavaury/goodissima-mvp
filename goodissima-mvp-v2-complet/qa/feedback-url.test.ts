import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { sanitizeFeedbackUrl } from "../lib/feedback-url.ts";
import * as productFeedback from "../lib/product-feedback.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

const secret = "SECRET-do-not-persist";
const queryNames = [
  "token", "trustAdmissionToken", "accessToken", "candidateAccessToken", "code",
  "guestAccessToken", "access_token", "refresh_token", "id_token", "client_secret",
  "password", "authorization", "api_key", "signature", "TOKEN", "Candidate_Access-Token",
  "code_verifier", "authorization_code", "otp",
];

for (const name of queryNames) {
  test(`redacts every ${name} value, including duplicate query keys`, () => {
    const result = sanitizeFeedbackUrl(`/login?${name}=${secret}&view=active&${name}=${secret}`)!;
    assert.ok(!result.includes(secret));
    const params = new URL(result, "https://test.invalid").searchParams;
    assert.deepEqual(params.getAll(name), ["[REDACTED]", "[REDACTED]"]);
    assert.equal(params.get("view"), "active");
  });
}

const privateUrls = [
  `/secure/${secret}`,
  `/gouvernance/invitation/${secret}`,
  `/gouvernance/invitation/${secret}/`,
  `/api/gouvernance/invitations/${secret}/media/livekit-token`,
  `/api/gouvernance/invitations/${secret}/media/attendance`,
  `/api/gouvernance/invitations/${secret}/media/session-usage`,
  `/l/example?trustAdmissionToken=${secret}`,
  `/l/example/confirmation?token=${secret}`,
  `/api/messages?candidateAccessToken=${secret}`,
  `/api/documents?candidateAccessToken=${secret}`,
  `/auth/callback?code=${secret}`,
  `/login?next=${encodeURIComponent(`/gouvernance/invitation/${secret}?view=active`)}`,
  `/login?next=${encodeURIComponent(`/auth/callback?code=${secret}&next=/dashboard`)}`,
  `/update-password#access_token=${secret}&refresh_token=${secret}&type=recovery`,
  `/update-password#access_token=${secret}%3Fpart%3Dvalue&view=active`,
  `/dashboard#section?code=${secret}&view=active`,
  `/secure%2F${secret}`,
  `/gouvernance/%2569nvitation/${secret}`,
  `/login?%2574oken=${secret}`,
  `https://user:${secret}@example.test/dashboard?view=active`,
];

test("redacts path tokens, encoded keys, nested redirects, URL credentials and auth fragments", () => {
  for (const input of privateUrls) {
    const result = sanitizeFeedbackUrl(input)!;
    assert.ok(!decodeURIComponent(result).includes(secret), `${input}: ${result}`);
    assert.equal(sanitizeFeedbackUrl(result), result, "sanitation must be idempotent");
  }
});

test("preserves ordinary route diagnostics, query values and safe anchors", () => {
  assert.equal(sanitizeFeedbackUrl("/opportunities?view=archived&templateId=tpl-123#results"),
    "/opportunities?view=archived&templateId=tpl-123#results");
  assert.equal(sanitizeFeedbackUrl("https://app.example/gouvernance/parcours/form-1/pilotage#meeting-42"),
    "/gouvernance/parcours/form-1/pilotage#meeting-42");
  assert.equal(sanitizeFeedbackUrl(`/secure/${secret}?view=documents#conversation`),
    "/secure/[REDACTED]?view=documents#conversation");
  const result = new URL(sanitizeFeedbackUrl(`/login?next=${encodeURIComponent(`/l/example?token=${secret}&view=active#respond`)}`)!, "https://test.invalid");
  assert.equal(new URL(result.searchParams.get("next")!, result).searchParams.get("view"), "active");
});

test("fails closed on unsupported, oversized and malformed inputs and limits nested URLs", () => {
  for (const input of ["javascript:SECRET", "/secure/%E0%A4%A", "x".repeat(20_000)]) {
    assert.equal(sanitizeFeedbackUrl(input), "[REDACTED]");
  }
  for (const input of [null, undefined, 42, {}, "  "]) assert.equal(sanitizeFeedbackUrl(input), null);
  let nested = `/secure/${secret}`;
  for (let i = 0; i < 8; i += 1) nested = `/login?next=${encodeURIComponent(nested)}`;
  assert.ok(!sanitizeFeedbackUrl(nested)!.includes(secret));
});

for (const fallback of [false, true]) {
  test(`real feedback handler sanitizes forged client input before ${fallback ? "JSONL fallback" : "database storage"}`, async () => {
    const attempted: unknown[] = [];
    const jsonl: string[] = [];
    const api = loadTestModule("app/api/feedback/route.ts", {
      "node:fs/promises": { mkdir: async () => {}, appendFile: async (_file: unknown, line: string) => { jsonl.push(line); } },
      "node:path": path,
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      "@/lib/auth": { getCurrentUser: async () => null },
      "@/lib/feedback-url": { sanitizeFeedbackUrl },
      "@/lib/product-feedback": productFeedback,
      "@/lib/prisma": { prisma: { productFeedback: { create: async ({ data }: any) => {
        attempted.push(data);
        if (fallback) throw new Error("Simulated storage outage");
        return data;
      } } } },
      "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("No attachment expected"); } },
    }, { process: { env: { NODE_ENV: "development" }, cwd: () => "/test-only" }, console: { info() {}, error() {} } });

    for (const page of [...privateUrls, ...queryNames.map((key) => `/dashboard?${key}=${secret}&view=active`)]) {
      for (const multipart of [false, true]) {
        const fields = { type: "Bug", message: "Navigation issue", page, includePageContext: "true" };
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.set(key, value);
        const response = await api.POST(new Request("https://test.invalid/api/feedback", multipart
          ? { method: "POST", body: form }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) }));
        assert.equal(response.status, 200);
        assert.equal((attempted.at(-1) as any).page, sanitizeFeedbackUrl(page));
      }
    }
    assert.ok(!JSON.stringify(attempted).includes(secret));
    assert.ok(!jsonl.join("").includes(secret));
    assert.equal(jsonl.length, fallback ? attempted.length : 0);
    for (const line of jsonl) assert.equal(JSON.parse(line).page, (attempted[jsonl.indexOf(line)] as any).page);
  });
}
