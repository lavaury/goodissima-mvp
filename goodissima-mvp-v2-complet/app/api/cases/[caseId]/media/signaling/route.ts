import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { exchangeRelationMediaSignals, type RelationMediaSignalType } from "@/lib/relation-media-signaling";
import { prisma } from "@/lib/prisma";
import {
  cancelExpiredRelationMediaSession,
  getRelationMediaSessionBlockedReason,
} from "@/lib/relation-media-sessions";
import { canWriteInRelation, getRelationGovernanceBlockedMessage } from "@/lib/relation-governance";

function normalizeBody(value: unknown): {
  sessionId?: unknown;
  peerId?: unknown;
  cursor?: unknown;
  messages?: unknown;
} {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeOutgoing(messages: unknown) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message): message is { type: RelationMediaSignalType; payload: unknown } => {
      if (!message || typeof message !== "object" || Array.isArray(message)) return false;
      const type = message.type;
      return type === "offer" || type === "answer" || type === "candidate" || type === "leave";
    })
    .map((message) => ({ type: message.type, payload: message.payload }));
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = normalizeBody(await req.json().catch(() => ({})));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const peerId = typeof body.peerId === "string" ? body.peerId : "";
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;
    const outgoing = normalizeOutgoing(body.messages);

    if (!sessionId || !peerId.startsWith("owner:")) {
      return NextResponse.json({ error: "Signalisation invalide." }, { status: 400 });
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
        expiresAt: true,
        relationCase: { select: { governanceStatus: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session media introuvable." }, { status: 404 });
    }
    if (!session.relationCase) return NextResponse.json({ error: "Relation introuvable." }, { status: 404 });

    if (!canWriteInRelation(session.relationCase.governanceStatus) && (outgoing.length === 0 || outgoing.some((message) => message.type !== "leave"))) {
      return NextResponse.json({ error: getRelationGovernanceBlockedMessage(session.relationCase.governanceStatus) }, { status: 409 });
    }

    const checkedSession = await cancelExpiredRelationMediaSession(session);
    const blockedReason = getRelationMediaSessionBlockedReason(checkedSession);
    if (blockedReason === "expired") {
      return NextResponse.json(
        { error: "Cette session a expire. Creez ou ouvrez une nouvelle session depuis le dossier.", state: "expired" },
        { status: 410 },
      );
    }

    if (blockedReason === "ended") {
      return NextResponse.json(
        { error: "Session terminee.", state: "ended" },
        { status: 410 },
      );
    }

    const exchange = exchangeRelationMediaSignals({
      sessionId,
      caseId: params.caseId,
      peerId,
      role: "OWNER",
      cursor,
      outgoing,
    });

    return NextResponse.json(exchange);
  } catch (error) {
    console.error("[relation-media] owner signaling failed", error);
    return NextResponse.json({ error: "Signalisation media indisponible." }, { status: 500 });
  }
}
