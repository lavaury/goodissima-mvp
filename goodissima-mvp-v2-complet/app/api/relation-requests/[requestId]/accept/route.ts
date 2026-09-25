import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptPublicRelationRequest } from "@/lib/public-relation-request";

export async function POST(_request: Request, { params }: { params: { requestId: string } }) {
  const user = await getCurrentPrismaUser();
  try { return NextResponse.json(await acceptPublicRelationRequest(prisma, { requestId: params.requestId, actorUserId: user.id, actorEmail: user.email })); }
  catch (error) { const code = error instanceof Error ? error.message : ""; return NextResponse.json({ error: "Demande indisponible." }, { status: code === "RELATION_REQUEST_NOT_PENDING" ? 409 : 404 }); }
}
