import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const signalType = typeof body.signalType === "string" ? body.signalType.slice(0, 100) : "UNKNOWN";

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "goodissima",
        model: "human-in-the-loop",
        action: "risk_signal_action_taken",
        status: "success",
        promptVersion: "risk-signals-v1",
        outputSummary: signalType,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ai] Unable to audit risk signal action", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_RISK_ACTION_ERROR",
    });
    return NextResponse.json({ error: "Impossible d'auditer l'action humaine" }, { status: 500 });
  }
}
