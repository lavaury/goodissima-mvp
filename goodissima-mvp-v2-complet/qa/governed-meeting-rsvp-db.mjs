import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.GOODISSIMA_ENV !== "staging" || !process.env.DIRECT_URL?.includes("rapidwfkaohweoovienf")) throw new Error("Staging target required");
const prisma = new PrismaClient();
const before = { sessions: await prisma.communicationSession.count(), participants: await prisma.governedMeetingParticipant.count(), rsvps: await prisma.governedMeetingRsvp.count(), events: await prisma.governedMeetingRsvpEvent.count() };
const observed = {};
try {
  await prisma.$transaction(async (tx) => {
    const template = await tx.relationTemplate.findFirst({ where: { workspace: { isNot: null } }, select: { id: true, workspaceId: true, workspace: { select: { ownerId: true } } } });
    if (!template?.workspace || !template.workspaceId) throw new Error("No Staging relation template with Workspace available");
    const now = new Date();
    const session = await tx.communicationSession.create({ data: { id: randomUUID(), ownerId: template.workspace.ownerId, workspaceId: template.workspaceId, relationTemplateId: template.id, channelType: "VIDEO_IP", provider: "NONE", status: "PREPARED_NOT_STARTED", title: "Rollback RSVP fixture", accessOpened: false } });
    const invitation = await tx.governedJourneyInvitation.create({ data: { id: randomUUID(), ownerId: template.workspace.ownerId, workspaceId: template.workspaceId, relationTemplateId: template.id, displayName: "Rollback RSVP fixture", role: "OBSERVER", status: "ACTIVE", accessTokenHash: createHash("sha256").update(randomUUID()).digest("hex"), accessTokenExpiresAt: new Date(now.getTime() + 60000) } });
    const participant = await tx.governedMeetingParticipant.create({ data: { id: randomUUID(), communicationSessionId: session.id, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", authorizedById: template.workspace.ownerId } });
    const rsvp = await tx.governedMeetingRsvp.create({ data: { id: randomUUID(), meetingParticipantId: participant.id, status: "PENDING", meetingRevision: 1 } });
    observed.pendingValid = rsvp.status === "PENDING";
    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.rsvp_actor_case(kind text, session_id text, invitation_id text, user_id text) RETURNS boolean LANGUAGE plpgsql AS $fn$ DECLARE participant_id text := gen_random_uuid()::text; BEGIN BEGIN INSERT INTO "GovernedMeetingParticipant" ("id","communicationSessionId","governedJourneyInvitationId","status","authorizedAt","createdAt","updatedAt") VALUES (participant_id,session_id,invitation_id,'AUTHORIZED',now(),now(),now()); IF kind='pending_no_actor' THEN INSERT INTO "GovernedMeetingRsvp" ("id","meetingParticipantId","status","version","meetingRevision","createdAt","updatedAt") VALUES (gen_random_uuid()::text,participant_id,'PENDING',0,1,now(),now()); ELSIF kind='pending_user' THEN INSERT INTO "GovernedMeetingRsvp" ("id","meetingParticipantId","status","decidedByUserId","version","meetingRevision","createdAt","updatedAt") VALUES (gen_random_uuid()::text,participant_id,'PENDING',user_id,0,1,now(),now()); ELSIF kind IN ('accepted_user','declined_user') THEN INSERT INTO "GovernedMeetingRsvp" ("id","meetingParticipantId","status","decidedAt","decidedByUserId","version","meetingRevision","createdAt","updatedAt") VALUES (gen_random_uuid()::text,participant_id,CASE WHEN kind='accepted_user' THEN 'ACCEPTED'::"MeetingRsvpStatus" ELSE 'DECLINED'::"MeetingRsvpStatus" END,now(),user_id,0,1,now(),now()); ELSIF kind IN ('accepted_guest','declined_guest') THEN INSERT INTO "GovernedMeetingRsvp" ("id","meetingParticipantId","status","decidedAt","decidedByInvitationId","version","meetingRevision","createdAt","updatedAt") VALUES (gen_random_uuid()::text,participant_id,CASE WHEN kind='accepted_guest' THEN 'ACCEPTED'::"MeetingRsvpStatus" ELSE 'DECLINED'::"MeetingRsvpStatus" END,now(),invitation_id,0,1,now(),now()); ELSIF kind='accepted_none' THEN INSERT INTO "GovernedMeetingRsvp" ("id","meetingParticipantId","status","decidedAt","version","meetingRevision","createdAt","updatedAt") VALUES (gen_random_uuid()::text,participant_id,'ACCEPTED',now(),0,1,now(),now()); ELSIF kind='accepted_both' THEN INSERT INTO "GovernedMeetingRsvp" ("id","meetingParticipantId","status","decidedAt","decidedByUserId","decidedByInvitationId","version","meetingRevision","createdAt","updatedAt") VALUES (gen_random_uuid()::text,participant_id,'ACCEPTED',now(),user_id,invitation_id,0,1,now(),now()); END IF; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END; END $fn$;`);
    const actorCases = { pending_no_actor: false, pending_user: true, accepted_user: false, declined_user: false, accepted_guest: false, declined_guest: false, accepted_none: true, accepted_both: true };
    for (const [kind, expectedBlocked] of Object.entries(actorCases)) {
      const caseInvitation = await tx.governedJourneyInvitation.create({ data: { id: randomUUID(), ownerId: template.workspace.ownerId, workspaceId: template.workspaceId, relationTemplateId: template.id, displayName: `RSVP actor case ${kind}`, role: "OBSERVER", status: "ACTIVE", accessTokenHash: createHash("sha256").update(randomUUID()).digest("hex"), accessTokenExpiresAt: new Date(now.getTime() + 60000) } });
      const [row] = await tx.$queryRawUnsafe(`SELECT pg_temp.rsvp_actor_case($1,$2,$3,$4) AS blocked`, kind, session.id, caseInvitation.id, template.workspace.ownerId);
      observed[kind] = row?.blocked === expectedBlocked;
    }
    const event = await tx.governedMeetingRsvpEvent.create({ data: { id: randomUUID(), meetingParticipantId: participant.id, rsvpId: rsvp.id, type: "INVITED", actorUserId: template.workspace.ownerId, actorKind: "ORGANIZER", rsvpVersion: 0, meetingRevision: 1 } });
    observed.eventInsert = Boolean(event.id);
    await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.rsvp_event_mutation(target_id text, operation text) RETURNS boolean LANGUAGE plpgsql AS $fn$ BEGIN BEGIN IF operation='update' THEN UPDATE "GovernedMeetingRsvpEvent" SET "occurredAt"="occurredAt" WHERE "id"=target_id; ELSE DELETE FROM "GovernedMeetingRsvpEvent" WHERE "id"=target_id; END IF; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM='GovernedMeetingRsvpEvent is append-only'; END; END $fn$;`);
    for (const operation of ["update", "delete"]) { const [row] = await tx.$queryRawUnsafe(`SELECT pg_temp.rsvp_event_mutation($1,$2) AS blocked`, event.id, operation); observed[`event_${operation}`] = row?.blocked === true; }
    throw new Error("ROLLBACK_MEETING_RSVP");
  });
} catch (error) { if (!(error instanceof Error) || error.message !== "ROLLBACK_MEETING_RSVP") throw error; }
const after = { sessions: await prisma.communicationSession.count(), participants: await prisma.governedMeetingParticipant.count(), rsvps: await prisma.governedMeetingRsvp.count(), events: await prisma.governedMeetingRsvpEvent.count() };
await prisma.$disconnect();
const passed = Object.values(observed).every(Boolean) && JSON.stringify(before) === JSON.stringify(after);
console.log(JSON.stringify({ observed, before, after, rollbackIntact: JSON.stringify(before) === JSON.stringify(after), passed }));
if (!passed) process.exitCode = 1;
