import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";

const rehearsalAllowed = process.env.M1_TEST_ALLOW_REHEARSAL === "YES";
const url = rehearsalAllowed ? process.env.DIRECT_URL : process.env.M1_TEST_DATABASE_URL;
const forbidden = /cbfcjyepfvuwugjiogoe|rapidwfkaohweoovienf/i;
if (!url || process.env.M1_TEST_CONFIRM_DISPOSABLE !== "YES") {
  test("M1 DB integration requires an explicit disposable PostgreSQL database", { skip: true }, () => {});
} else {
  const parsed = new URL(url);
  const exactRehearsal = rehearsalAllowed && url.includes("hkhupnhxfncbfhystvua") && parsed.pathname === "/postgres";
  const localDisposable = !rehearsalAllowed && !/hkhupnhxfncbfhystvua/i.test(url)
    && parsed.pathname.slice(1).startsWith("m1_test_");
  if (forbidden.test(url) || !(exactRehearsal || localDisposable)) {
    throw new Error("M1 DB tests refuse non-disposable and known deployment databases");
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const rolledBack = "M1_DB_TEST_ROLLBACK";

  async function fixture(withCase, operation) {
    try {
      await prisma.$transaction(async (tx) => {
        const suffix = randomUUID();
        const user = await tx.user.create({ data: { id: `m1-user-${suffix}`, email: `m1-${suffix}@example.invalid` } });
        const template = await tx.relationTemplate.create({ data: { key: `m1-${suffix}`, name: "M1 rollback fixture" } });
        const version = await tx.templateVersion.create({ data: { templateId: template.id, version: 1, name: "M1", snapshot: {} } });
        let relationCaseId = null;
        if (withCase) {
          const link = await tx.gLink.create({ data: { ownerId: user.id, slug: `m1-${suffix}`, title: "M1", templateId: template.id } });
          const relationCase = await tx.relationCase.create({ data: {
            gLinkId: link.id, ownerId: user.id, candidateName: "M1 fixture", candidateEmail: `candidate-${suffix}@example.invalid`,
            candidateAccessToken: `m1-${suffix}`, templateId: template.id,
          } });
          relationCaseId = relationCase.id;
        }
        const journey = await tx.governedJourney.create({ data: {
          id: `m1-journey-${suffix}`, relationTemplateId: template.id, relationCaseId,
          createdFromTemplateVersionId: version.id, title: "M1", authorityUserId: user.id, updatedAt: new Date(),
        } });
        const event = (overrides = {}) => tx.governedJourneyEvent.create({ data: {
          id: `m1-event-${randomUUID()}`, governedJourneyId: journey.id, relationCaseId,
          authorityUserId: user.id, actorUserId: user.id, type: "CREATED", occurredAt: new Date(),
          fromStatus: null, toStatus: "DRAFT", sequence: 1, ...overrides,
        } });
        const source = (eventId, overrides = {}) => tx.governedMemorySource.create({ data: {
          id: `m1-source-${randomUUID()}`, relationTemplateId: template.id, relationCaseId,
          governedJourneyId: journey.id, governedJourneyEventId: eventId,
          kind: "HUMAN_DECLARATION", sourceObjectType: "M1_TEST", sourceObjectId: suffix,
          title: "M1 rollback fixture", recordedAt: new Date(), updatedAt: new Date(), ...overrides,
        } });
        await operation({ tx, user, template, journey, relationCaseId, event, source });
        throw new Error(rolledBack);
      });
    } catch (error) {
      if (error?.message === rolledBack) return { allowed: true };
      return { allowed: false, error: String(error?.message ?? error) };
    }
    throw new Error("Fixture transaction unexpectedly committed");
  }

  async function allowed(withCase, operation) {
    assert.deepEqual(await fixture(withCase, operation), { allowed: true });
  }
  async function denied(withCase, operation, pattern) {
    const result = await fixture(withCase, operation);
    assert.equal(result.allowed, false);
    assert.match(result.error, pattern);
  }

  test("M1 enforces case scope, authority, provenance and existing lifecycle on disposable DB", async () => {
    try {
      await allowed(true, async ({ event }) => { await event(); });
      await allowed(false, async ({ event }) => { await event(); });
      await denied(true, async ({ event }) => { await event({ relationCaseId: null }); }, /relationCaseId differs/);
      await denied(false, async ({ event }) => { await event({ relationCaseId: randomUUID() }); }, /relationCaseId differs/);
      await denied(true, async ({ event }) => { await event({ relationCaseId: randomUUID() }); }, /relationCaseId differs/);
      await denied(false, async ({ event }) => { await event({ authorityUserId: randomUUID() }); }, /foreign key|P2003/i);
      await denied(false, async ({ event }) => { await event({ actorUserId: randomUUID() }); }, /foreign key|P2003/i);
      await denied(false, async ({ event }) => { await event({ sequence: 2 }); }, /check constraint|transition_check|P2004/i);
      await denied(false, async ({ event }) => { await event(); await event(); }, /unique constraint|P2002/i);
      await allowed(false, async ({ event }) => {
        await event();
        await event({ type: "ACTIVATED", sequence: 2, fromStatus: "DRAFT", toStatus: "ACTIVE" });
      });
      await denied(false, async ({ tx, journey }) => {
        await tx.governedJourney.update({ where: { id: journey.id }, data: { relationCaseId: randomUUID() } });
      }, /identity is immutable/);
      await denied(false, async ({ tx, journey }) => {
        await tx.governedJourney.update({ where: { id: journey.id }, data: { authorityUserId: randomUUID() } });
      }, /identity is immutable/);
      await denied(false, async ({ tx, journey }) => {
        await tx.governedJourney.update({ where: { id: journey.id }, data: { relationTemplateId: randomUUID() } });
      }, /identity is immutable/);
      await allowed(false, async ({ event, source }) => { const created = await event(); await source(created.id); });
      await denied(false, async ({ event, source }) => {
        const created = await event(); await source(created.id, { governedJourneyId: randomUUID() });
      }, /foreign key|P2003/i);
      await denied(false, async ({ tx, event }) => {
        const created = await event(); await tx.governedJourneyEvent.update({ where: { id: created.id }, data: { reason: "changed" } });
      }, /append-only/);
      await denied(false, async ({ tx, event }) => {
        const created = await event(); await tx.governedJourneyEvent.delete({ where: { id: created.id } });
      }, /append-only/);
      await denied(true, async ({ event, source }) => {
        const created = await event(); await source(created.id, { relationCaseId: null });
      }, /relationCaseId differs/);
    } finally { await prisma.$disconnect(); }
  });
}
