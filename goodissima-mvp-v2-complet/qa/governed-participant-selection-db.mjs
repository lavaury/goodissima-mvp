import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.GOODISSIMA_ENV !== "staging" || !process.env.DIRECT_URL?.includes("rapidwfkaohweoovienf")) {
  throw new Error("Staging target required");
}

const prisma = new PrismaClient();
const countTables = () => Promise.all([
  prisma.governedParticipantSelection.count(),
  prisma.governedParticipantSelectionItem.count(),
  prisma.governedParticipantSelectionEvent.count(),
]);
const before = await countTables();
const rolesBefore = await prisma.governedJourneyExpectedRoleAssignment.count();
const observed = {};

try {
  await prisma.$transaction(async (tx) => {
    const targets = await tx.$queryRaw`
      SELECT gj."id" AS "journeyId", gj."relationTemplateId", cs."id" AS "sessionId", cs."ownerId"
      FROM "GovernedJourney" gj
      JOIN "CommunicationSession" cs ON cs."relationTemplateId" = gj."relationTemplateId"
      WHERE cs."relationTemplateId" IS NOT NULL
      LIMIT 1
    `;
    const target = targets[0];
    if (!target) throw new Error("No coherent Staging Journey meeting available");

    const secondUser = await tx.user.create({
      data: { email: `selection-${randomUUID()}@example.invalid`, name: "Same public name" },
      select: { id: true },
    });
    const thirdUser = await tx.user.create({
      data: { email: `selection-${randomUUID()}@example.invalid`, name: "Same public name" },
      select: { id: true },
    });
    const fourthUser = await tx.user.create({
      data: { email: `selection-${randomUUID()}@example.invalid`, name: "Materialization fixture" },
      select: { id: true },
    });
    const invitation = await tx.governedJourneyInvitation.create({
      data: {
        ownerId: target.ownerId,
        relationTemplateId: target.relationTemplateId,
        displayName: "Selection guest fixture",
        role: "OBSERVER",
        accessTokenHash: randomUUID().replaceAll("-", ""),
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
      },
      select: { id: true },
    });
    const selection = await tx.governedParticipantSelection.create({
      data: {
        ownerId: target.ownerId,
        governedJourneyId: target.journeyId,
        relationTemplateId: target.relationTemplateId,
        communicationSessionId: target.sessionId,
        source: "JOURNEY_MEMBERS",
        criteria: { status: "ACTIVE" },
        createdByUserId: target.ownerId,
      },
    });
    observed.draft = selection.status === "DRAFT" && selection.version === 0;

    await tx.governedParticipantSelectionItem.createMany({
      data: [
        {
          selectionId: selection.id,
          communicationSessionId: target.sessionId,
          relationTemplateId: target.relationTemplateId,
          canonicalUserId: secondUser.id,
          snapshotDisplayName: "Same public name",
          observedEligibility: "ELIGIBLE",
        },
        {
          selectionId: selection.id,
          communicationSessionId: target.sessionId,
          relationTemplateId: target.relationTemplateId,
          canonicalUserId: thirdUser.id,
          snapshotDisplayName: "Same public name",
          observedEligibility: "ELIGIBLE",
        },
        {
          selectionId: selection.id,
          communicationSessionId: target.sessionId,
          relationTemplateId: target.relationTemplateId,
          canonicalInvitationId: invitation.id,
          sourceInvitationId: invitation.id,
          snapshotDisplayName: "Selection guest fixture",
          observedEligibility: "ELIGIBLE",
        },
      ],
    });
    observed.sameNameDifferentIds = (await tx.governedParticipantSelectionItem.count({ where: { selectionId: selection.id } })) === 3;
    observed.guestIdentity = Boolean(await tx.governedParticipantSelectionItem.findFirst({ where: { selectionId: selection.id, canonicalInvitationId: invitation.id } }));

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_insert_blocked(selection_id text, session_id text, template_id text, user_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","communicationSessionId","relationTemplateId","canonicalUserId","snapshotDisplayName","observedEligibility","decision","createdAt","updatedAt") VALUES (item_id,selection_id,session_id,template_id,user_id,'Different display name','ELIGIBLE','UNDECIDED',now(),now()); RETURN false; EXCEPTION WHEN unique_violation THEN RETURN true; END; END $fn$;`);
    const [duplicateResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_insert_blocked($1,$2,$3,$4,$5) AS blocked`, selection.id, target.sessionId, target.relationTemplateId, secondUser.id, randomUUID());
    observed.duplicateIdentityBlocked = duplicateResult?.blocked === true;

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_xor_blocked(selection_id text, session_id text, template_id text, user_id text, invitation_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","communicationSessionId","relationTemplateId","canonicalUserId","canonicalInvitationId","snapshotDisplayName","observedEligibility","decision","createdAt","updatedAt") VALUES (item_id,selection_id,session_id,template_id,user_id,invitation_id,'Invalid dual identity','ELIGIBLE','UNDECIDED',now(),now()); RETURN false; EXCEPTION WHEN check_violation THEN RETURN true; END; END $fn$;`);
    const [xorResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_xor_blocked($1,$2,$3,$4,$5,$6) AS blocked`, selection.id, target.sessionId, target.relationTemplateId, fourthUser.id, invitation.id, randomUUID());
    observed.identityXorBlocked = xorResult?.blocked === true;

    const meetingParticipant = await tx.governedMeetingParticipant.create({
      data: {
        communicationSessionId: target.sessionId,
        governedJourneyInvitationId: invitation.id,
        authorizedById: target.ownerId,
      },
      select: { id: true },
    });
    const guestItem = await tx.governedParticipantSelectionItem.findFirstOrThrow({
      where: { selectionId: selection.id, canonicalInvitationId: invitation.id },
      select: { id: true },
    });
    await tx.governedParticipantSelectionItem.update({
      where: { id: guestItem.id },
      data: { materializedMeetingParticipantId: meetingParticipant.id },
    });
    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_materialization_blocked(selection_id text, session_id text, template_id text, user_id text, participant_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","communicationSessionId","relationTemplateId","canonicalUserId","snapshotDisplayName","observedEligibility","decision","materializedMeetingParticipantId","createdAt","updatedAt") VALUES (item_id,selection_id,session_id,template_id,user_id,'Duplicate materialization','ELIGIBLE','UNDECIDED',participant_id,now(),now()); RETURN false; EXCEPTION WHEN unique_violation THEN RETURN true; END; END $fn$;`);
    const [materializationResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_materialization_blocked($1,$2,$3,$4,$5,$6) AS blocked`, selection.id, target.sessionId, target.relationTemplateId, fourthUser.id, meetingParticipant.id, randomUUID());
    observed.materializedParticipantUnique = materializationResult?.blocked === true;

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_event_mutation(target_id text, operation text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN IF operation='update' THEN UPDATE "GovernedParticipantSelectionEvent" SET "occurredAt"="occurredAt" WHERE "id"=target_id; ELSE DELETE FROM "GovernedParticipantSelectionEvent" WHERE "id"=target_id; END IF; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM='GovernedParticipantSelectionEvent is append-only'; END; END $fn$;`);
    const event = await tx.governedParticipantSelectionEvent.create({ data: { selectionId: selection.id, type: "CREATED", actorUserId: target.ownerId, version: 0, summary: { candidates: 3 } } });
    const [updateResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_event_mutation($1,'update') AS blocked`, event.id);
    const [deleteResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_event_mutation($1,'delete') AS blocked`, event.id);
    observed.eventAppendOnly = updateResult?.blocked === true && deleteResult?.blocked === true;

    const otherOwner = secondUser.id;
    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_cross_owner_blocked(selection_id text, owner_id text, journey_id text, template_id text, session_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelection" ("id","ownerId","governedJourneyId","relationTemplateId","communicationSessionId","source","status","criteria","createdByUserId","version","createdAt","updatedAt") VALUES (selection_id,owner_id,journey_id,template_id,session_id,'JOURNEY_MEMBERS','DRAFT','{}'::jsonb,owner_id,0,now(),now()); RETURN false; EXCEPTION WHEN foreign_key_violation THEN RETURN true; END; END $fn$;`);
    const [crossOwnerResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_cross_owner_blocked($1,$2,$3,$4,$5) AS blocked`, randomUUID(), otherOwner, target.journeyId, target.relationTemplateId, target.sessionId);
    observed.crossOwnerBlocked = crossOwnerResult?.blocked === true;

    throw new Error("ROLLBACK_GOVERNED_PARTICIPANT_SELECTION");
  });
} catch (error) {
  if (!(error instanceof Error) || error.message !== "ROLLBACK_GOVERNED_PARTICIPANT_SELECTION") throw error;
}

const after = await countTables();
const rolesAfter = await prisma.governedJourneyExpectedRoleAssignment.count();
await prisma.$disconnect();
observed.tablesInitiallyEmpty = before.every((count) => count === 0);
observed.rollbackIntact = JSON.stringify(before) === JSON.stringify(after);
observed.noJourneyRoleCreated = rolesBefore === rolesAfter;
const passed = Object.values(observed).every(Boolean);
console.log(JSON.stringify({ observed, before, after, rolesBefore, rolesAfter, passed }));
if (!passed) process.exitCode = 1;
