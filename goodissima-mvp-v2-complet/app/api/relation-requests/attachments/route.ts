import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPendingAttachmentTicket, MAX_PENDING_ATTACHMENT_SIZE } from "@/lib/pending-public-attachments";

const BUCKET = "case-documents";
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
function safeName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120); }

export async function POST(request: Request) {
  const form = await request.formData();
  const gLinkId = form.get("gLinkId"); const file = form.get("file");
  if (typeof gLinkId !== "string" || !gLinkId || !(file instanceof File)) return NextResponse.json({ error: "Pièce jointe invalide." }, { status: 400 });
  if (!ALLOWED_MIME_TYPES.has(file.type) || file.size > MAX_PENDING_ATTACHMENT_SIZE) return NextResponse.json({ error: "Type ou taille de fichier non autorisé." }, { status: file.size > MAX_PENDING_ATTACHMENT_SIZE ? 413 : 415 });
  const link = await prisma.gLink.findFirst({ where: { id: gLinkId, status: "ACTIVE" }, select: { id: true } });
  if (!link) return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  const storageKey = `pending/${gLinkId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await createAdminClient().storage.from(BUCKET).upload(storageKey, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (error) return NextResponse.json({ error: "Téléversement impossible." }, { status: 503 });
  const attachment = { storageKey, fileName: file.name.slice(0, 255), mimeType: file.type, size: file.size };
  return NextResponse.json({ uploadToken: createPendingAttachmentTicket({ ...attachment, gLinkId }), attachment });
}
