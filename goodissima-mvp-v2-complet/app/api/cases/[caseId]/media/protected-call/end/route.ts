import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
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
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session media introuvable." }, { status: 404 });
    }

    const endedSession =
      session.status === "COMPLETED" || session.status === "CANCELLED"
        ? session
        : await prisma.communicationSession.update({
            where: { id: session.id },
            data: {
              status: "COMPLETED",
              accessOpened: false,
              note: reason,
            },
            select: {
              id: true,
              status: true,
            },
          });

    clearRelationMediaSignals(session.id);
    revalidatePath(`/cases/${params.caseId}`);
    revalidatePath("/gouvernance");

    return NextResponse.json({ session: endedSession, state: "ended" });
  } catch (error) {
    console.error("[relation-media] owner end failed", error);
    return NextResponse.json({ error: "Impossible de terminer la session media." }, { status: 500 });
  }
}
