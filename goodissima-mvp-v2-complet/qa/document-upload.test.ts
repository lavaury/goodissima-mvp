import assert from "node:assert/strict";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

function setup(access = true) {
  const queries: unknown[] = [], documents: Record<string, unknown>[] = [], uploads: File[] = [];
  const noop = async () => {};
  const route = loadTestModule<{ POST(request: Request): Promise<Response> }>("app/api/documents/upload/route.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "next/cache": { revalidatePath: noop },
    "@/lib/audit": { auditLog: noop },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner" }) },
    "@/lib/candidate-access": { activeCandidateAccessWhere: (token: string) => ({ candidateAccessToken: token }) },
    "@/lib/email": { sendNewDocumentEmail: noop },
    "@/lib/ai/embedding-jobs": { enqueueEmbeddingJob: noop },
    "@/lib/events": { createRelationEvent: noop },
    "@/lib/privacy": { isNotificationEnabled: () => false, logNotificationSkipped: noop },
    "@/lib/prisma": { prisma: {
      relationCase: { findFirst: async (query: unknown) => {
        queries.push(query);
        return access ? { id: "case", candidateEmail: "candidate@example.test", governanceStatus: "ACTIVE", owner: { email: "owner@example.test" } } : null;
      } },
      document: { create: async ({ data }: { data: Record<string, unknown> }) => { documents.push(data); return { id: "document", ...data }; } },
    } },
    "@/lib/relation-governance": { normalizeRelationGovernanceStatus: (s: string) => s, canWriteInRelation: () => true },
    "@/lib/supabase/admin": { createAdminClient: () => ({ storage: { from: () => ({ upload: async (_path: string, file: File) => {
      uploads.push(file); return { data: {}, error: null };
    } }) } }) },
  }, { console: { info() {}, warn() {}, error() {} }, process: { env: {} } });
  return { ...route, queries, documents, uploads };
}

function request(context: "owner" | "candidate", withFile = true) {
  const data = new FormData();
  data.set(context === "owner" ? "caseId" : "candidateAccessToken", context === "owner" ? "case" : "test-token");
  if (withFile) data.set("file", new File(["%PDF-test"], "document.pdf", { type: "application/pdf" }));
  return new Request("https://example.test/api/documents/upload", { method: "POST", body: data });
}

for (const context of ["owner", "candidate"] as const) {
  test(`multipart upload reads native FormData fields and File for ${context}`, async () => {
    const s = setup();
    const response = await s.POST(request(context));
    assert.equal(response.status, 200);
    assert.equal(s.uploads.length, 1);
    assert.ok(s.uploads[0] instanceof File);
    assert.equal(await s.uploads[0].text(), "%PDF-test");
    assert.equal(s.documents[0].uploadedByEmail, `${context}@example.test`);
    assert.equal(s.documents[0].fileName, "document.pdf");
    assert.equal(s.documents[0].mimeType, "application/pdf");
    const body = await response.json();
    assert.equal(body.id, "document");
    assert.ok(!("uploadedByEmail" in body));
    assert.ok(!("fileUrl" in body));
    assert.deepEqual((s.queries[0] as { where: unknown }).where, context === "owner" ? { id: "case", ownerId: "owner" } : { candidateAccessToken: "test-token" });
  });
}

test("missing File is rejected before access or storage", async () => {
  const s = setup();
  const response = await s.POST(request("owner", false));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "MISSING_REQUIRED_FIELDS");
  assert.deepEqual(s.queries, []);
  assert.deepEqual(s.uploads, []);
});

test("inaccessible case cannot upload or create a document", async () => {
  const s = setup(false);
  const response = await s.POST(request("owner"));
  assert.equal(response.status, 404);
  assert.deepEqual(s.uploads, []);
  assert.deepEqual(s.documents, []);
});
