import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { declinePublicRelationRequest } from "@/lib/public-relation-request";
import { notifyPublicRelationRequestDecision } from "@/lib/public-relation-request-notification";

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const user = await getCurrentPrismaUser();
  const body = await request.json().catch(() => ({}));
  if (typeof body.gLinkId !== "string") return NextResponse.json({ error: "Demande indisponible." }, { status: 404 });
  try { const decision = await declinePublicRelationRequest(prisma, { requestId: params.requestId, actorUserId: user.id, actorEmail: user.email, reason: typeof body.reason === "string" ? body.reason : undefined, gLinkId: body.gLinkId }); const notificationStatus = decision.replayed ? null : await notifyPublicRelationRequestDecision(prisma, { requestId: params.requestId, actorUserId: user.id, actorEmail: user.email, decision: "DECLINED" }); return NextResponse.json({ requestId: decision.requestId, replayed: decision.replayed, notificationStatus }); }
  catch (error) { const code = error instanceof Error ? error.message : ""; return NextResponse.json({ error: code === "RELATION_REQUEST_INVALID_REASON" ? "Le motif du refus doit contenir entre 3 et 500 caractères." : "Demande indisponible." }, { status: code === "RELATION_REQUEST_INVALID_REASON" ? 400 : code === "RELATION_REQUEST_NOT_PENDING" ? 409 : 404 }); }
}
