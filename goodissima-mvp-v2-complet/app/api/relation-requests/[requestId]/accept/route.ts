import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptPublicRelationRequest } from "@/lib/public-relation-request";
import { notifyPublicRelationRequestDecision } from "@/lib/public-relation-request-notification";

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const user = await getCurrentPrismaUser();
  const body = await request.json().catch(() => ({}));
  if (typeof body.gLinkId !== "string") return NextResponse.json({ error: "Demande indisponible." }, { status: 404 });
  try { const decision = await acceptPublicRelationRequest(prisma, { requestId: params.requestId, actorUserId: user.id, actorEmail: user.email, gLinkId: body.gLinkId }); const notificationStatus = decision.replayed ? null : await notifyPublicRelationRequestDecision(prisma, { requestId: params.requestId, actorUserId: user.id, actorEmail: user.email, decision: "ACCEPTED" }); return NextResponse.json({ requestId: decision.requestId, relationCaseId: decision.relationCaseId, replayed: decision.replayed, notificationStatus }); }
  catch (error) { const code = error instanceof Error ? error.message : ""; return NextResponse.json({ error: "Demande indisponible." }, { status: code === "RELATION_REQUEST_NOT_PENDING" ? 409 : 404 }); }
}
