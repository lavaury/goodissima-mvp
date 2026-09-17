import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

const now = new Date("2026-09-18T12:00:00.000Z");
const jsx = {
  jsx: (type: any, props: any) => ({ type, props }),
  jsxs: (type: any, props: any) => ({ type, props }),
};
const activeSession = {
  ownerId: "owner-1",
  relationTemplateId: "journey-1",
  relationCaseId: null,
  provider: "LIVEKIT_PENDING",
  status: "REQUESTED",
  accessOpened: true,
  expiresAt: new Date("2026-09-19T12:00:00.000Z"),
  rsvpRevision: 2,
};
const acceptedAuthorization = {
  status: "AUTHORIZED",
  rsvp: { status: "ACCEPTED", meetingRevision: 2 },
  communicationSession: activeSession,
};

function fixture(overrides: {
  invitation?: Record<string, any>;
  authorization?: any;
  identityMatches?: boolean;
} = {}) {
  const invitation = {
    id: "invitation-1",
    ownerId: "owner-1",
    relationTemplateId: "journey-1",
    inviteeUserId: null,
    status: "ACTIVE",
    revokedAt: null,
    accessTokenExpiresAt: new Date("2026-09-19T12:00:00.000Z"),
    consent: { status: "ACCEPTED" },
    ...overrides.invitation,
  };
  const authorization = Object.hasOwn(overrides, "authorization")
    ? overrides.authorization
    : acceptedAuthorization;
  let identityChecks = 0;
  const { default: page } = loadTestModule<any>(
    "app/gouvernance/invitation/[token]/reunions/[meetingId]/page.tsx",
    {
      "react/jsx-runtime": jsx,
      "next/link": (props: any) => jsx.jsx("a", props),
      "next/navigation": {
        notFound: () => {
          throw new Error("NEXT_NOT_FOUND");
        },
      },
      "@/components/RelationLiveKitMediaRoom": {
        RelationLiveKitMediaRoom: () => null,
      },
      "@/lib/governed-journey-invitations": {
        hashJourneyInvitationToken: (token: string) => `hash:${token}`,
      },
      "@/lib/governed-journey-invitation-identity": {
        invitationIdentityMatches: async () => {
          identityChecks++;
          return overrides.identityMatches ?? true;
        },
      },
      "@/lib/governed-journey-consent": {
        hasCurrentJourneyAccess: (value: any) =>
          value.status === "ACTIVE" &&
          !value.revokedAt &&
          value.accessTokenExpiresAt > now &&
          value.consent?.status === "ACCEPTED",
      },
      "@/lib/governed-meeting-rsvp": {
        hasCurrentMeetingMediaAccess: (value: any) =>
          value.status === "AUTHORIZED" &&
          value.rsvp?.status === "ACCEPTED" &&
          value.rsvp.meetingRevision === value.communicationSession.rsvpRevision &&
          value.communicationSession.status === "REQUESTED" &&
          value.communicationSession.accessOpened &&
          value.communicationSession.expiresAt > now,
      },
      "@/lib/prisma": {
        prisma: {
          governedJourneyInvitation: {
            findUnique: async ({ where }: any) =>
              where.accessTokenHash === "hash:guest-token" ? invitation : null,
          },
          governedMeetingParticipant: {
            findFirst: async ({ where }: any) => {
              if (
                where.communicationSessionId !== "meeting-1" ||
                where.governedJourneyInvitationId !== invitation.id ||
                !authorization
              )
                return null;
              const session = authorization.communicationSession;
              return session.ownerId === where.communicationSession.ownerId &&
                session.relationTemplateId ===
                  where.communicationSession.relationTemplateId
                ? authorization
                : null;
            },
          },
        },
      },
    },
  );
  return { page, identityChecks: () => identityChecks };
}

test("accepted external guest reaches the room without a Goodissima identity check", async () => {
  const context = fixture();
  await context.page({
    params: { token: "guest-token", meetingId: "meeting-1" },
  });
  assert.equal(context.identityChecks(), 0);
});

test("account invitation still requires the matching Goodissima identity", async () => {
  await assert.rejects(
    () =>
      fixture({
        invitation: { inviteeUserId: "user-1" },
        identityMatches: false,
      }).page({ params: { token: "guest-token", meetingId: "meeting-1" } }),
    /NEXT_NOT_FOUND/,
  );
});

test("room refuses invalid RSVP, invitation, meeting and scope", async () => {
  const cases = [
    { authorization: { ...acceptedAuthorization, rsvp: { status: "PENDING", meetingRevision: 2 } } },
    { authorization: { ...acceptedAuthorization, rsvp: { status: "DECLINED", meetingRevision: 2 } } },
    { invitation: { status: "REVOKED", revokedAt: now } },
    { invitation: { accessTokenExpiresAt: new Date("2026-09-17T12:00:00.000Z") } },
    { authorization: null },
    { authorization: { ...acceptedAuthorization, communicationSession: { ...activeSession, ownerId: "owner-2" } } },
    { authorization: { ...acceptedAuthorization, communicationSession: { ...activeSession, relationTemplateId: "journey-2" } } },
    { authorization: { ...acceptedAuthorization, communicationSession: { ...activeSession, status: "COMPLETED", accessOpened: false } } },
  ];
  for (const value of cases)
    await assert.rejects(
      () => fixture(value).page({ params: { token: "guest-token", meetingId: "meeting-1" } }),
      /NEXT_NOT_FOUND/,
    );
  await assert.rejects(
    () => fixture().page({ params: { token: "guest-token", meetingId: "wrong-meeting" } }),
    /NEXT_NOT_FOUND/,
  );
});

test("guest uses the invitation route and session id while organizer route stays authenticated", () => {
  const invitationPage = readFileSync(new URL("../app/gouvernance/invitation/[token]/page.tsx", import.meta.url), "utf8");
  const guestRoom = readFileSync(new URL("../app/gouvernance/invitation/[token]/reunions/[meetingId]/page.tsx", import.meta.url), "utf8");
  const ownerRoom = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/reunions/[meetingId]/page.tsx", import.meta.url), "utf8");
  const tokenRoute = readFileSync(new URL("../app/api/gouvernance/invitations/[id]/media/livekit-token/route.ts", import.meta.url), "utf8");
  assert.match(invitationPage, /invitation\/\$\{params\.token\}\/reunions\/\$\{session\.id\}/);
  assert.match(guestRoom, /communicationSessionId: params\.meetingId/);
  assert.match(guestRoom, /guestAccessToken=\{params\.token\}/);
  assert.match(guestRoom, /ownerId: invitation\.ownerId/);
  assert.match(guestRoom, /relationTemplateId: invitation\.relationTemplateId/);
  assert.match(tokenRoute, /invitation\.inviteeUserId &&/);
  assert.match(ownerRoom, /getCurrentPrismaUser/);
});

test("guest room reuses the opt-in media prejoin", () => {
  const mediaRoom = readFileSync(new URL("../components/media/GoodissimaMediaRoom.tsx", import.meta.url), "utf8");
  assert.match(mediaRoom, /joinLabel = "Rejoindre la réunion"/);
  assert.match(mediaRoom, /setJoined\(true\)/);
});
