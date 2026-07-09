import { NextResponse } from "next/server";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { exchangeRelationMediaSignals, type RelationMediaSignalType } from "@/lib/relation-media-signaling";
import { prisma } from "@/lib/prisma";

function normalizeBody(value: unknown): {
  candidateAccessToken?: unknown;
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
    const body = normalizeBody(await req.json().catch(() => ({})));
    const candidateAccessToken =
      typeof body.candidateAccessToken === "string" ? body.candidateAccessToken.trim() : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const peerId = typeof body.peerId === "string" ? body.peerId : "";
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;

    if (!candidateAccessToken || !sessionId || !peerId.startsWith("candidate:")) {
      return NextResponse.json({ error: "Signalisation candidat invalide." }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: {
        id: params.caseId,
        ...activeCandidateAccessWhere(candidateAccessToken),
      },
      select: {
        id: true,
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Acces candidat invalide." }, { status: 404 });
    }

    const session = await prisma.communicationSession.findFirst({
      where: {
        id: sessionId,
        relationCaseId: relationCase.id,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session media introuvable." }, { status: 404 });
    }

    const exchange = exchangeRelationMediaSignals({
      sessionId,
      peerId,
      role: "CANDIDATE",
      cursor,
      outgoing: normalizeOutgoing(body.messages),
    });

    return NextResponse.json(exchange);
  } catch (error) {
    console.error("[relation-media] candidate signaling failed", error);
    return NextResponse.json({ error: "Signalisation media candidat indisponible." }, { status: 500 });
  }
}
