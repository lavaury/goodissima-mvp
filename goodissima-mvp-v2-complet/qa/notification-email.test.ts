import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const defaults = { emailNotificationsEnabled: true, newMessagesEnabled: true, newRequestsEnabled: true, newDocumentsEnabled: true, validationsEnabled: true, frequency: "IMMEDIATE" };
const privacy = loadTestModule<any>("lib/privacy.ts", {});

function serviceFixture(options: { type?: string; preferences?: any; previous?: boolean; send?: () => Promise<any> } = {}) {
  const sent: any[] = [];
  const createdAt = new Date("2026-09-13T12:00:00Z");
  const notification = {
    id: "notification", type: options.type ?? "NEW_MESSAGE", recipientUserId: "owner", relationCaseId: "case", createdAt,
    recipient: { email: "owner@example.test", notificationPreferences: options.preferences === undefined ? defaults : options.preferences },
    relationCase: { ownerId: "owner", gLink: { title: "Recherche de baby-sitter" } },
  };
  const send = async (input: any) => { sent.push(input); return options.send ? options.send() : { ok: true }; };
  const service = loadTestModule<any>("lib/notification-email.ts", {
    "@/lib/prisma": { prisma: { notification: { findUnique: async () => notification, findFirst: async (query: any) => {
      assert.equal(query.where.id.not, "notification");
      assert.equal(query.where.createdAt.gte.toISOString(), "2026-09-13T11:30:00.000Z");
      return options.previous ? { id: "previous" } : null;
    } } } },
    "@/lib/email": { sendNewMessageEmail: send, sendNewRelationCaseEmail: send },
    "@/lib/privacy": { defaultNotificationPreferences: defaults, isNotificationEnabled: privacy.isNotificationEnabled },
  });
  return { service, sent, notification };
}

test("NEW_RELATION_CASE sends once from the persisted notification with a safe owner CTA", async () => {
  const { service, sent } = serviceFixture({ type: "NEW_RELATION_CASE" });
  assert.deepEqual(await service.maybeSendNotificationEmail("notification"), { status: "sent" });
  assert.deepEqual(sent, [{ ownerEmail: "owner@example.test", caseId: "case", caseTitle: "Recherche de baby-sitter" }]);
});

test("NEW_MESSAGE cooldown permits first, suppresses recent, and excludes the current notification", async () => {
  const first = serviceFixture();
  assert.equal((await first.service.maybeSendNotificationEmail("notification")).status, "sent");
  const recent = serviceFixture({ previous: true });
  assert.deepEqual(await recent.service.maybeSendNotificationEmail("notification"), { status: "skipped", reason: "cooldown" });
  assert.equal(recent.sent.length, 0);
});

test("canonical defaults apply without a preference row; explicit off and digest frequencies do not send immediately", async () => {
  const missing = serviceFixture({ preferences: null });
  assert.equal((await missing.service.maybeSendNotificationEmail("notification")).status, "sent");
  const off = serviceFixture({ preferences: { ...defaults, newMessagesEnabled: false } });
  assert.deepEqual(await off.service.maybeSendNotificationEmail("notification"), { status: "skipped", reason: "messages_disabled" });
  for (const frequency of ["DAILY", "WEEKLY"]) {
    const digest = serviceFixture({ preferences: { ...defaults, frequency } });
    assert.deepEqual(await digest.service.maybeSendNotificationEmail("notification"), { status: "skipped", reason: "frequency_not_immediate" });
  }
});

test("provider absence or failure never throws into the committed business action", async () => {
  const absent = serviceFixture({ send: async () => ({ ok: false, skipped: true }) });
  assert.deepEqual(await absent.service.maybeSendNotificationEmail("notification"), { status: "skipped", reason: "provider_unavailable" });
  const failure = serviceFixture({ send: async () => { throw new Error("secret provider detail"); } });
  assert.deepEqual(await failure.service.maybeSendNotificationEmail("notification"), { status: "failed", reason: "provider_failure" });
});

test("owner notification email templates contain no message, identity, token or secure route", async () => {
  const deliveries: any[] = [];
  const email = loadTestModule<any>("lib/email.ts", {
    resend: { Resend: class { emails = { send: async (payload: any) => { deliveries.push(payload); return { data: { id: "mail" } }; } }; } },
    "@/lib/public-app-url": { getPublicAppUrl: () => "https://preview.example" },
  }, { process: { env: { RESEND_API_KEY: "test-key" } }, console });
  await email.sendNewMessageEmail({ ownerEmail: "owner@example.test", caseId: "case", caseTitle: "Baby-sitter" });
  await email.sendNewRelationCaseEmail({ ownerEmail: "owner@example.test", caseId: "case", caseTitle: "Baby-sitter" });
  const serialized = JSON.stringify(deliveries);
  for (const forbidden of ["secret message body", "candidate@example", "private-", "candidateAccessToken", "/secure/", "matching", "identity", "trust"]) assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  assert.match(serialized, /https:\/\/preview\.example\/cases\/case/);
  assert.equal(deliveries.length, 2);
});

test("Settings, authentication and server delivery share the same canonical defaults", () => {
  for (const file of ["lib/auth.ts", "app/api/settings/notifications/route.ts", "app/(connected)/settings/page.tsx", "lib/notification-email.ts"]) {
    assert.match(readFileSync(file, "utf8"), /defaultNotificationPreferences/);
  }
});
