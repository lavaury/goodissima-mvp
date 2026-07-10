import { NextResponse } from "next/server";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { markLiveKitSessionMediaUsage } from "@/lib/relation-media-sessions";
import { prisma } from "@/lib/prisma";

const usages = new Set(["audio", "video", "screen"] as const);

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const candidateAccessToken = typeof body.candidateAccessToken === "string" ? body.candidateAccessToken.trim() : "";
    const communicationSessionId = typeof body.communicationSessionId === "string" ? body.communicationSessionId : "";
    const usage = typeof body.usage === "string" ? body.usage : "";
    if (!candidateAccessToken || !communicationSessionId || !usages.has(usage as "audio" | "video" | "screen")) {
      return NextResponse.json({ error: "Usage media invalide." }, { status: 400 });
    }
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ...activeCandidateAccessWhere(candidateAccessToken) },
      select: { id: true },
    });
    if (!relationCase) return NextResponse.json({ error: "Relation ou acces candidat invalide." }, { status: 404 });
    const session = await markLiveKitSessionMediaUsage({
      communicationSessionId,
      relationCaseId: relationCase.id,
      usage: usage as "audio" | "video" | "screen",
    });
    if (!session) return NextResponse.json({ error: "Session active introuvable." }, { status: 404 });
    return NextResponse.json({ updated: true });
  } catch {
    return NextResponse.json({ error: "Impossible d'historiser le media." }, { status: 500 });
  }
}
