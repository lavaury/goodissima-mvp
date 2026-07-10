import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getLiveKitConfig } from "@/lib/media/livekit-config";
import { createLiveKitRoomName } from "@/lib/media/livekit-token-service";
import { clearRelationMediaSignals } from "@/lib/relation-media-signaling";
import { prisma } from "@/lib/prisma";

function normalizeBody(value: unknown): { sessionId?: unknown; reason?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = normalizeBody(await req.json().catch(() => ({})));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Fin explicite par proprietaire.";

    if (!sessionId) {
      return NextResponse.json({ error: "Session media requise." }, { status: 400 });
    }

    const session = await prisma.communicationSession.findFirst({
      where: {
        id: sessionId,
        ownerId: owner.id,
        relationCaseId: params.caseId,
      },
      select: {
        id: true,
        status: true,
        provider: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session media introuvable." }, { status: 404 });
    }

    if (session.provider === "LIVEKIT_PENDING") {
      const { livekitUrl, apiKey, apiSecret } = getLiveKitConfig();
      const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
      await roomService.deleteRoom(createLiveKitRoomName(session.id));
    }

    await prisma.communicationSession.updateMany({
      where: {
        relationCaseId: params.caseId,
        ownerId: owner.id,
        OR: [
          { id: session.id },
          {
            provider: "MANUAL_EXTERNAL",
            accessOpened: true,
          },
        ],
        status: {
          in: ["REQUESTED", "PREPARED_NOT_STARTED"],
        },
      },
      data: {
        status: "COMPLETED",
        accessOpened: false,
        note: reason,
      },
    });

    const endedSession = await prisma.communicationSession.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        status: true,
      },
    });

    clearRelationMediaSignals(session.id);
    revalidatePath(`/cases/${params.caseId}`);
    revalidatePath("/gouvernance");

    return NextResponse.json({ session: endedSession ?? session, state: "ended" });
  } catch (error) {
    console.error("[relation-media] owner end failed", error);
    return NextResponse.json({ error: "Impossible de terminer la session media." }, { status: 500 });
  }
}
