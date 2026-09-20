import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";

const url = process.env.M2_TEST_DATABASE_URL;
if (!url || process.env.M2_TEST_CONFIRM_REHEARSAL !== "YES") {
  test("M2 DB matrix requires explicit Rehearsal authorization", { skip: true }, () => {});
} else {
  const parsed = new URL(url);
  if (!url.includes("hkhupnhxfncbfhystvua") || /cbfcjyepfvuwugjiogoe|rapidwfkaohweoovienf/i.test(url)
      || parsed.pathname !== "/postgres") throw new Error("M2 DB target guard failed");
  const db = new PrismaClient({ datasources: { db: { url } } });
  const rollback = "M2_FIXTURE_ROLLBACK";

  async function scenario(withCase, mutation, attemptCommit = false) {
    const suffix = randomUUID();
    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { id: `m2-user-${suffix}`, email: `m2-${suffix}@example.invalid` } });
        const template = await tx.relationTemplate.create({ data: { key: `m2-${suffix}`, name: "M2 rollback fixture" } });
        const version = await tx.templateVersion.create({ data: { templateId: template.id, version: 1, name: "M2", snapshot: {} } });
        let caseId = null;
        if (withCase) {
          const link = await tx.gLink.create({ data: { ownerId: user.id, slug: `m2-${suffix}`, title: "M2", templateId: template.id } });
          const relationCase = await tx.relationCase.create({ data: {
            gLinkId: link.id, ownerId: user.id, candidateName: "M2 fixture", candidateEmail: `candidate-${suffix}@example.invalid`,
            candidateAccessToken: `m2-${suffix}`, templateId: template.id,
          } });
          caseId = relationCase.id;
        }
        const journey = await tx.governedJourney.create({ data: {
          id: `m2-journey-${suffix}`, relationTemplateId: template.id, relationCaseId: caseId,
          createdFromTemplateVersionId: version.id, title: "M2", authorityUserId: user.id, updatedAt: new Date(),
        } });
        const event = (overrides = {}) => tx.governedJourneyEvent.create({ data: {
          id: `m2-event-${randomUUID()}`, governedJourneyId: journey.id, relationCaseId: caseId,
          authorityUserId: user.id, actorUserId: user.id, type: "CREATED", occurredAt: new Date(),
          fromStatus: null, toStatus: "DRAFT", sequence: 1, ...overrides,
        } });
        await mutation({ tx, journey, event, caseId });
        // PostgreSQL fires initially-deferred constraint triggers here, exactly as at COMMIT.
        if (!attemptCommit) await tx.$executeRawUnsafe('SET CONSTRAINTS "GovernedJourney_created_at_commit" IMMEDIATE');
        if (!attemptCommit) throw new Error(rollback);
      });
    } catch (error) {
      if (error?.message === rollback) return { accepted: true };
      return { accepted: false, error: String(error?.message ?? error) };
    }
    if (attemptCommit) {
      const persisted = await db.governedJourney.count({ where: { id: `m2-journey-${suffix}` } });
      if (persisted === 0) return { accepted: false, error: "COMMIT rejected: no Journey persisted" };
    }
    throw new Error("Fixture unexpectedly committed");
  }
  async function pass(withCase, mutation) { assert.deepEqual(await scenario(withCase, mutation), { accepted: true }); }
  async function fail(withCase, mutation, pattern, attemptCommit = false) {
    const result = await scenario(withCase, mutation, attemptCommit);
    assert.equal(result.accepted, false);
    assert.match(result.error, pattern);
  }

  test("M2 DB matrix uses deferred check and rolls all fixtures back", async () => {
    try {
      await fail(false, async () => {}, /COMMIT rejected|exactly one valid CREATED/, true); // A: actual COMMIT fails
      await pass(false, async ({ event }) => { await event(); }); // B, G
      await fail(false, async ({ tx, event }) => {
        const other = await tx.user.create({ data: { id: `m2-actor-${randomUUID()}`, email: `m2-actor-${randomUUID()}@example.invalid` } });
        await event({ actorUserId: other.id });
      }, /exactly one valid CREATED/i); // C: valid User, wrong Journey authority
      await fail(false, async ({ event }) => { await event({ sequence: 2 }); }, /check constraint|P2004/i); // D
      await fail(false, async ({ event }) => { await event({ toStatus: "ACTIVE" }); }, /check constraint|P2004/i); // E
      await fail(false, async ({ event }) => { await event(); await event({ id: `m2-second-${randomUUID()}` }); }, /unique constraint|P2002/i); // F
      await pass(true, async ({ event }) => { await event(); }); // H
      await fail(true, async ({ event }) => { await event({ relationCaseId: null }); }, /relationCaseId differs/); // I
      await fail(false, async ({ event }) => { await event({ relationCaseId: randomUUID() }); }, /relationCaseId differs/); // J
      await fail(false, async ({ tx, event }) => {
        const created = await event();
        await tx.governedJourneyEvent.update({ where: { id: created.id }, data: { reason: "changed" } });
      }, /append-only/); // K update
      await fail(false, async ({ tx, event }) => {
        const created = await event();
        await tx.governedJourneyEvent.delete({ where: { id: created.id } });
      }, /append-only/); // K delete
      assert.equal(await db.governedJourney.count({ where: { title: "M2" } }), 0); // L
    } finally { await db.$disconnect(); }
  });
}
