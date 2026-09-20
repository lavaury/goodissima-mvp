// One-off Rehearsal-only repro. Run only with an explicitly guarded URL.
// The positive case intentionally leaves one fixture on the disposable clone.
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const url = process.env.M2_BRIDGE_DATABASE_URL;
if (process.env.M2_BRIDGE_CONFIRM_REHEARSAL !== "YES"
    || !url?.includes("hkhupnhxfncbfhystvua")
    || /cbfcjyepfvuwugjiogoe|rapidwfkaohweoovienf/i.test(url)
    || new URL(url).pathname !== "/postgres") {
  throw new Error("M2 bridge repro requires the exact Rehearsal target");
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const probe = new PrismaClient({ datasources: { db: { url } } });
const check = 'SET CONSTRAINTS "GovernedJourney_created_at_commit" IMMEDIATE';

async function runCase(label, { created, explicitCheck }) {
  const suffix = randomUUID();
  const journeyId = `m2-bridge-${label}-${suffix}`;
  const eventId = `m2-bridge-event-${suffix}`;
  let outcome = "RESOLVED";
  let error = null;
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: {
        id: `m2-bridge-user-${suffix}`, email: `m2-bridge-${suffix}@example.invalid`,
      } });
      const template = await tx.relationTemplate.create({ data: {
        key: `m2-bridge-${suffix}`, name: "M2 client bridge repro",
      } });
      const version = await tx.templateVersion.create({ data: {
        templateId: template.id, version: 1, name: "M2", snapshot: {},
      } });
      await tx.governedJourney.create({ data: {
        id: journeyId, relationTemplateId: template.id,
        createdFromTemplateVersionId: version.id, title: "M2 bridge repro",
        authorityUserId: user.id, updatedAt: new Date(),
      } });
      if (created) await tx.governedJourneyEvent.create({ data: {
        id: eventId, governedJourneyId: journeyId, relationCaseId: null,
        type: "CREATED", actorUserId: user.id, authorityUserId: user.id,
        occurredAt: new Date(), fromStatus: null, toStatus: "DRAFT", sequence: 1,
      } });
      if (explicitCheck) await tx.$executeRawUnsafe(check);
    });
  } catch (cause) {
    outcome = "REJECTED";
    error = {
      name: cause.name,
      prismaCode: cause.code ?? null,
      postgresCode: cause.meta?.code ?? null,
      message: String(cause.message).replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_URL]").slice(0, 400),
    };
  }
  const journey = await probe.governedJourney.findUnique({
    where: { id: journeyId },
    select: { id: true, authorityUserId: true, relationCaseId: true,
      events: { select: { id: true, type: true, sequence: true, fromStatus: true,
        toStatus: true, actorUserId: true, authorityUserId: true, relationCaseId: true } } },
  });
  const event = journey?.events[0];
  return {
    label, journeyId, eventId: created ? eventId : null, outcome, error,
    persisted: Boolean(journey), eventCount: journey?.events.length ?? 0,
    createdValid: Boolean(journey && event && journey.events.length === 1
      && event.type === "CREATED" && event.sequence === 1 && event.fromStatus === null
      && event.toStatus === "DRAFT" && event.actorUserId === journey.authorityUserId
      && event.authorityUserId === journey.authorityUserId
      && event.relationCaseId === journey.relationCaseId),
  };
}

try {
  const deferredFailure = await runCase("deferred-failure", { created: false, explicitCheck: false });
  const explicitFailure = await runCase("explicit-failure", { created: false, explicitCheck: true });
  const explicitSuccess = process.env.M2_BRIDGE_ALLOW_POSITIVE_COMMIT === "YES"
    ? await runCase("explicit-success", { created: true, explicitCheck: true })
    : "SKIPPED: set M2_BRIDGE_ALLOW_POSITIVE_COMMIT=YES to leave a positive fixture";
  console.log(JSON.stringify({ deferredFailure, explicitFailure, explicitSuccess }));
} finally {
  await Promise.all([prisma.$disconnect(), probe.$disconnect()]);
}
