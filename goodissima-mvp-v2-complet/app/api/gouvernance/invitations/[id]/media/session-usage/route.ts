import { NextResponse } from "next/server";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";
import { markLiveKitSessionMediaUsage } from "@/lib/relation-media-sessions";

const usages = new Set(["audio", "video", "screen"]);
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const usage = typeof body.usage === "string" ? body.usage : "";
  const communicationSessionId = typeof body.communicationSessionId === "string" ? body.communicationSessionId : "";
  if (!communicationSessionId || !usages.has(usage)) return NextResponse.json({ error: "Usage média invalide." }, { status: 400 });
  const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(params.id) } });
  if (!invitation || invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= new Date()) return NextResponse.json({ error: "Accès invité invalide." }, { status: 403 });
  const session = await markLiveKitSessionMediaUsage({ communicationSessionId, relationTemplateId: invitation.relationTemplateId, usage: usage as "audio" | "video" | "screen" });
  return session ? NextResponse.json({ updated: true }) : NextResponse.json({ error: "Session active introuvable." }, { status: 404 });
}
