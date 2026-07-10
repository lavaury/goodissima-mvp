import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { updateCommunicationAttendance } from "@/lib/communication-attendance";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser(); const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const sessionId = typeof body.communicationSessionId === "string" ? body.communicationSessionId : "";
  const event = body.event === "leave" ? "leave" : body.event === "join" ? "join" : body.event === "media" ? "media" : null;
  const media = body.media === "audio" || body.media === "video" || body.media === "screen" ? body.media : undefined;
  const form = await prisma.formTemplate.findFirst({ where: { id: params.id, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplateId: true } });
  if (!form?.relationTemplateId || !sessionId || !event) return NextResponse.json({ error: "Présence invalide." }, { status: 400 });
  const session = await prisma.communicationSession.findFirst({ where: { id: sessionId, ownerId: owner.id, relationTemplateId: form.relationTemplateId, relationCaseId: null }, select: { id: true } });
  if (!session) return NextResponse.json({ error: "Session non autorisée." }, { status: 403 });
  await updateCommunicationAttendance({ sessionId, participantKey: `owner:${owner.id}`, displayName: owner.name ?? "Organisateur", roleLabel: "Organisateur", accessKind: "Compte Goodissima", actorKind: "owner", event, media });
  return NextResponse.json({ updated: true });
}
