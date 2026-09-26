import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type Attachment = { storageKey?: unknown; fileName?: unknown };
export async function GET(_request: Request, { params }: { params: { requestId: string; index: string } }) {
  const owner = await getCurrentPrismaUser();
  const pending = await prisma.publicCaseCreationRequest.findFirst({ where: { id: params.requestId, status: { in: ["PENDING", "ACCEPTED", "DECLINED"] }, gLink: { ownerId: owner.id } }, select: { requestPayload: true } });
  if (!pending) return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  const payload = pending.requestPayload && typeof pending.requestPayload === "object" && !Array.isArray(pending.requestPayload) ? pending.requestPayload as Record<string, unknown> : {};
  const attachments = Array.isArray(payload.attachments) ? payload.attachments as Attachment[] : [];
  const index = Number(params.index); const attachment = Number.isSafeInteger(index) ? attachments[index] : null;
  if (!attachment || typeof attachment.storageKey !== "string" || typeof attachment.fileName !== "string") return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from("case-documents").createSignedUrl(attachment.storageKey, 5 * 60, { download: attachment.fileName });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Pièce jointe indisponible." }, { status: 503 });
  return NextResponse.json({ signedUrl: data.signedUrl });
}
