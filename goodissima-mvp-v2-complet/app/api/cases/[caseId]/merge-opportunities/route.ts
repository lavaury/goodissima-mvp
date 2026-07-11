import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { getDemoMergeOpportunities } from "@/lib/merge-opportunities";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true },
    });
    if (!relationCase) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    if (!isGoodissimaDebugMode()) return NextResponse.json({ requesterLabel: "", opportunities: [], unavailableReason: "Les scénarios de démonstration sont désactivés." });

    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario") === "employment" ? "employment" : "housing";
    const includeNoMatch = isGoodissimaDebugMode() && url.searchParams.get("includeNoMatch") === "true";
    return NextResponse.json(await getDemoMergeOpportunities(scenario, { includeNoMatch }));
  } catch (error) {
    console.error("[merge-opportunities] Unable to evaluate", error);
    return NextResponse.json({ error: "Impossible d'evaluer les opportunites de fusion" }, { status: 500 });
  }
}
