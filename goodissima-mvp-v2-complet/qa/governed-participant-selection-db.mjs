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
        targetType: "MEETING",
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
          relationTemplateId: target.relationTemplateId,
          canonicalUserId: secondUser.id,
          snapshotDisplayName: "Same public name",
          observedEligibility: "ELIGIBLE",
        },
        {
          selectionId: selection.id,
          relationTemplateId: target.relationTemplateId,
          canonicalUserId: thirdUser.id,
          snapshotDisplayName: "Same public name",
          observedEligibility: "ELIGIBLE",
        },
        {
          selectionId: selection.id,
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

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_insert_blocked(selection_id text, template_id text, user_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","relationTemplateId","canonicalUserId","snapshotDisplayName","observedEligibility","decision","createdAt","updatedAt") VALUES (item_id,selection_id,template_id,user_id,'Different display name','ELIGIBLE','UNDECIDED',now(),now()); RETURN false; EXCEPTION WHEN unique_violation THEN RETURN true; END; END $fn$;`);
    const [duplicateResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_insert_blocked($1,$2,$3,$4) AS blocked`, selection.id, target.relationTemplateId, secondUser.id, randomUUID());
    observed.duplicateIdentityBlocked = duplicateResult?.blocked === true;

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_xor_blocked(selection_id text, template_id text, user_id text, invitation_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","relationTemplateId","canonicalUserId","canonicalInvitationId","snapshotDisplayName","observedEligibility","decision","createdAt","updatedAt") VALUES (item_id,selection_id,template_id,user_id,invitation_id,'Invalid dual identity','ELIGIBLE','UNDECIDED',now(),now()); RETURN false; EXCEPTION WHEN check_violation THEN RETURN true; END; END $fn$;`);
    const [xorResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_xor_blocked($1,$2,$3,$4,$5) AS blocked`, selection.id, target.relationTemplateId, fourthUser.id, invitation.id, randomUUID());
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
    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_materialization_blocked(selection_id text, template_id text, user_id text, participant_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","relationTemplateId","canonicalUserId","snapshotDisplayName","observedEligibility","decision","materializedMeetingParticipantId","createdAt","updatedAt") VALUES (item_id,selection_id,template_id,user_id,'Duplicate materialization','ELIGIBLE','UNDECIDED',participant_id,now(),now()); RETURN false; EXCEPTION WHEN unique_violation THEN RETURN true; END; END $fn$;`);
    const [materializationResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_materialization_blocked($1,$2,$3,$4,$5) AS blocked`, selection.id, target.relationTemplateId, fourthUser.id, meetingParticipant.id, randomUUID());
    observed.materializedParticipantUnique = materializationResult?.blocked === true;

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_event_mutation(target_id text, operation text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN IF operation='update' THEN UPDATE "GovernedParticipantSelectionEvent" SET "occurredAt"="occurredAt" WHERE "id"=target_id; ELSE DELETE FROM "GovernedParticipantSelectionEvent" WHERE "id"=target_id; END IF; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM='GovernedParticipantSelectionEvent is append-only'; END; END $fn$;`);
    const event = await tx.governedParticipantSelectionEvent.create({ data: { selectionId: selection.id, type: "CREATED", actorUserId: target.ownerId, version: 0, summary: { candidates: 3 } } });
    const [updateResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_event_mutation($1,'update') AS blocked`, event.id);
    const [deleteResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_event_mutation($1,'delete') AS blocked`, event.id);
    observed.eventAppendOnly = updateResult?.blocked === true && deleteResult?.blocked === true;

    const otherOwner = secondUser.id;
    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_cross_owner_blocked(selection_id text, owner_id text, journey_id text, template_id text, session_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelection" ("id","ownerId","governedJourneyId","relationTemplateId","targetType","communicationSessionId","source","status","criteria","createdByUserId","version","createdAt","updatedAt") VALUES (selection_id,owner_id,journey_id,template_id,'MEETING',session_id,'JOURNEY_MEMBERS','DRAFT','{}'::jsonb,owner_id,0,now(),now()); RETURN false; EXCEPTION WHEN foreign_key_violation THEN RETURN true; END; END $fn$;`);
    const [crossOwnerResult] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_cross_owner_blocked($1,$2,$3,$4,$5) AS blocked`, randomUUID(), otherOwner, target.journeyId, target.relationTemplateId, target.sessionId);
    observed.crossOwnerBlocked = crossOwnerResult?.blocked === true;

    observed.meetingTargetValid = selection.targetType === "MEETING" && selection.communicationSessionId === target.sessionId;
    const journeySelection = await tx.governedParticipantSelection.create({
      data: {
        ownerId: target.ownerId,
        governedJourneyId: target.journeyId,
        relationTemplateId: target.relationTemplateId,
        targetType: "JOURNEY",
        source: "DIRECTORY",
        criteria: { status: "PUBLISHED" },
        createdByUserId: target.ownerId,
      },
    });
    observed.journeyTargetWithoutSessionValid = journeySelection.communicationSessionId === null;

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_target_blocked(target_type "GovernedParticipantSelectionTargetType", session_id text, selection_id text, owner_id text, journey_id text, template_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelection" ("id","ownerId","governedJourneyId","relationTemplateId","targetType","communicationSessionId","source","status","criteria","createdByUserId","version","createdAt","updatedAt") VALUES (selection_id,owner_id,journey_id,template_id,target_type,session_id,'DIRECTORY','DRAFT','{}'::jsonb,owner_id,0,now(),now()); RETURN false; EXCEPTION WHEN check_violation THEN RETURN true; END; END $fn$;`);
    const [journeyWithMeeting] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_target_blocked('JOURNEY',$1,$2,$3,$4,$5) AS blocked`, target.sessionId, randomUUID(), target.ownerId, target.journeyId, target.relationTemplateId);
    const [meetingWithoutMeeting] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_target_blocked('MEETING',NULL,$1,$2,$3,$4) AS blocked`, randomUUID(), target.ownerId, target.journeyId, target.relationTemplateId);
    observed.targetXorBlocked = journeyWithMeeting?.blocked === true && meetingWithoutMeeting?.blocked === true;

    const journeyMaterialized = await tx.governedParticipantSelectionItem.create({
      data: {
        selectionId: journeySelection.id,
        relationTemplateId: target.relationTemplateId,
        canonicalInvitationId: invitation.id,
        sourceInvitationId: invitation.id,
        snapshotDisplayName: "Journey materialization fixture",
        observedEligibility: "ELIGIBLE",
        materializedJourneyInvitationId: invitation.id,
      },
    });
    observed.journeyMaterializationValid = journeyMaterialized.materializedJourneyInvitationId === invitation.id;

    const secondInvitation = await tx.governedJourneyInvitation.create({
      data: {
        ownerId: target.ownerId,
        relationTemplateId: target.relationTemplateId,
        displayName: "Second selection guest fixture",
        role: "OBSERVER",
        accessTokenHash: randomUUID().replaceAll("-", ""),
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
      },
      select: { id: true },
    });
    const otherSession = await tx.communicationSession.create({
      data: {
        ownerId: target.ownerId,
        relationTemplateId: target.relationTemplateId,
        channelType: "VIDEO_IP",
        provider: "NONE",
        status: "PREPARED_NOT_STARTED",
        title: "Other selection meeting",
      },
      select: { id: true },
    });
    const otherMeetingParticipant = await tx.governedMeetingParticipant.create({
      data: { communicationSessionId: otherSession.id, governedJourneyInvitationId: secondInvitation.id, authorizedById: target.ownerId },
      select: { id: true },
    });

    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.selection_item_blocked(selection_id text, template_id text, user_id text, journey_invitation_id text, meeting_participant_id text, item_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN INSERT INTO "GovernedParticipantSelectionItem" ("id","selectionId","relationTemplateId","canonicalUserId","snapshotDisplayName","observedEligibility","decision","materializedJourneyInvitationId","materializedMeetingParticipantId","createdAt","updatedAt") VALUES (item_id,selection_id,template_id,user_id,'Target guard fixture','ELIGIBLE','UNDECIDED',journey_invitation_id,meeting_participant_id,now(),now()); RETURN false; EXCEPTION WHEN check_violation OR raise_exception OR foreign_key_violation OR unique_violation THEN RETURN true; END; END $fn$;`);
    const [journeyToMeeting] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_item_blocked($1,$2,$3,NULL,$4,$5) AS blocked`, journeySelection.id, target.relationTemplateId, fourthUser.id, meetingParticipant.id, randomUUID());
    const [meetingToJourney] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_item_blocked($1,$2,$3,$4,NULL,$5) AS blocked`, selection.id, target.relationTemplateId, fourthUser.id, secondInvitation.id, randomUUID());
    const [dualMaterialization] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_item_blocked($1,$2,$3,$4,$5,$6) AS blocked`, journeySelection.id, target.relationTemplateId, fourthUser.id, secondInvitation.id, meetingParticipant.id, randomUUID());
    const [crossMeeting] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_item_blocked($1,$2,$3,NULL,$4,$5) AS blocked`, selection.id, target.relationTemplateId, fourthUser.id, otherMeetingParticipant.id, randomUUID());
    const [crossJourney] = await tx.$queryRawUnsafe(`SELECT pg_temp.selection_item_blocked($1,$2,$3,NULL,NULL,$4) AS blocked`, journeySelection.id, `${target.relationTemplateId}-outside`, fourthUser.id, randomUUID());
    observed.targetMaterializationBlocked = journeyToMeeting?.blocked === true && meetingToJourney?.blocked === true;
    observed.dualMaterializationBlocked = dualMaterialization?.blocked === true;
    observed.crossMeetingBlocked = crossMeeting?.blocked === true;
    observed.crossJourneyBlocked = crossJourney?.blocked === true;

    const directoryProfile = await tx.directoryProfile.findFirst({ select: { id: true } });
    if (!directoryProfile) throw new Error("No Staging DirectoryProfile available for provenance test");
    const provenanceItem = await tx.governedParticipantSelectionItem.create({
      data: {
        selectionId: journeySelection.id,
        relationTemplateId: target.relationTemplateId,
        canonicalUserId: fourthUser.id,
        sourceDirectoryProfileId: directoryProfile.id,
        snapshotDisplayName: "Directory provenance fixture",
        observedEligibility: "ELIGIBLE",
      },
    });
    observed.userIdentityDirectoryProvenance = provenanceItem.canonicalUserId === fourthUser.id && provenanceItem.sourceDirectoryProfileId === directoryProfile.id;

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
