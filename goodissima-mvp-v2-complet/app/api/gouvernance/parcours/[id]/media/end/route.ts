import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getLiveKitConfig } from "@/lib/media/livekit-config";
import { createLiveKitRoomName } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const owner = await getCurrentPrismaUser(); const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const form = await prisma.formTemplate.findFirst({ where: { id: params.id, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplateId: true } });
    if (!form?.relationTemplateId || !sessionId) return NextResponse.json({ error: "Session ou parcours invalide." }, { status: 400 });
    const session = await prisma.communicationSession.findFirst({ where: { id: sessionId, ownerId: owner.id, relationTemplateId: form.relationTemplateId, relationCaseId: null }, select: { id: true, provider: true } });
    if (!session) return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
    if (session.provider === "LIVEKIT_PENDING") { const { livekitUrl, apiKey, apiSecret } = getLiveKitConfig(); await new RoomServiceClient(livekitUrl, apiKey, apiSecret).deleteRoom(createLiveKitRoomName(session.id)); }
    await prisma.communicationSession.update({ where: { id: session.id }, data: { status: "COMPLETED", accessOpened: false, note: "Session terminée explicitement par l'organisateur du parcours." } });
    revalidatePath(`/gouvernance/parcours/${params.id}/pilotage`);
    return NextResponse.json({ state: "ended" });
  } catch { return NextResponse.json({ error: "Impossible de terminer la session." }, { status: 500 }); }
}
