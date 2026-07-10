import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markLiveKitSessionMediaUsage } from "@/lib/relation-media-sessions";
const usages = new Set(["audio", "video", "screen"]);
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser(); const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const usage = typeof body.usage === "string" ? body.usage : ""; const communicationSessionId = typeof body.communicationSessionId === "string" ? body.communicationSessionId : "";
  const form = await prisma.formTemplate.findFirst({ where: { id: params.id, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplateId: true } });
  if (!form?.relationTemplateId || !communicationSessionId || !usages.has(usage)) return NextResponse.json({ error: "Usage média invalide." }, { status: 400 });
  const session = await markLiveKitSessionMediaUsage({ communicationSessionId, relationTemplateId: form.relationTemplateId, usage: usage as "audio" | "video" | "screen" });
  return session ? NextResponse.json({ updated: true }) : NextResponse.json({ error: "Session active introuvable." }, { status: 404 });
}
