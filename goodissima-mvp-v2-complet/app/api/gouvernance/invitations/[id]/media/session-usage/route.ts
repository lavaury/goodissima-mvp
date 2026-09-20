import { NextResponse } from "next/server";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";
import { markLiveKitSessionMediaUsage } from "@/lib/relation-media-sessions";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-consent";
import { invitationIdentityMatches } from "@/lib/governed-journey-invitation-identity";
import { hasCurrentMeetingMediaAccess } from "@/lib/governed-meeting-rsvp";

const usages = new Set(["audio", "video", "screen"]);
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const usage = typeof body.usage === "string" ? body.usage : "";
  const communicationSessionId = typeof body.communicationSessionId === "string" ? body.communicationSessionId : "";
  if (!communicationSessionId || !usages.has(usage)) return NextResponse.json({ error: "Usage média invalide." }, { status: 400 });
  const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(params.id) }, include: { consent: true } });
  if (!invitation || !hasCurrentJourneyAccess(invitation)) return NextResponse.json({ error: "Accès invité invalide." }, { status: 403 });
  if (invitation.consent && !await invitationIdentityMatches(invitation.inviteeUserId)) return NextResponse.json({ error: "Accès invité invalide." }, { status: 403 });
  const authorization = await prisma.governedMeetingParticipant.findFirst({ where: { communicationSessionId, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", communicationSession: { ownerId: invitation.ownerId, relationTemplateId: invitation.relationTemplateId, relationCaseId: null, provider: "LIVEKIT_PENDING", status: "REQUESTED", accessOpened: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }, include: { rsvp: true, communicationSession: true } });
  if (!authorization || !hasCurrentMeetingMediaAccess(authorization)) return NextResponse.json({ error: "Votre accès ne permet pas de rejoindre cette réunion." }, { status: 403 });
  const session = await markLiveKitSessionMediaUsage({ communicationSessionId, relationTemplateId: invitation.relationTemplateId, usage: usage as "audio" | "video" | "screen" });
  return session ? NextResponse.json({ updated: true }) : NextResponse.json({ error: "Session active introuvable." }, { status: 404 });
}
