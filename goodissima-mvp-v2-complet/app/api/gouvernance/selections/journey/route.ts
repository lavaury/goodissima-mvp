import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inviteSelectionToJourney } from "@/lib/governed-journey-selection";

export async function POST(request: Request) {
  const user = await getCurrentPrismaUser(); const body = await request.json().catch(() => ({}));
  const source = body.source === "MATCHING" ? "MATCHING" : body.source === "DIRECTORY" ? "DIRECTORY" : null;
  const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds.filter((id: unknown): id is string => typeof id === "string" && Boolean(id)) : [];
  if (!source || typeof body.journeyId !== "string") return NextResponse.json({ error: "Sélection invalide." }, { status: 400 });
  try { return NextResponse.json(await inviteSelectionToJourney(prisma, { authorityUserId: user.id, journeyId: body.journeyId, source, candidateIds })); }
  catch { return NextResponse.json({ error: "Sélection indisponible." }, { status: 404 }); }
}
