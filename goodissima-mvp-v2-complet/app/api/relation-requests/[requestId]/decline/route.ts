import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { declinePublicRelationRequest } from "@/lib/public-relation-request";

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const user = await getCurrentPrismaUser();
  const body = await request.json().catch(() => ({}));
  try { return NextResponse.json(await declinePublicRelationRequest(prisma, { requestId: params.requestId, actorUserId: user.id, actorEmail: user.email, reason: typeof body.reason === "string" ? body.reason : undefined })); }
  catch (error) { const code = error instanceof Error ? error.message : ""; return NextResponse.json({ error: "Demande indisponible." }, { status: code === "RELATION_REQUEST_NOT_PENDING" ? 409 : 404 }); }
}
