import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { canAccessFeedbackAdmin, feedbackScreenshotBucketName } from "@/lib/product-feedback";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

export async function GET(req: Request, { params }: { params: { attachmentId: string } }) {
  const owner = await getCurrentPrismaUser();

  if (!canAccessFeedbackAdmin(owner.role)) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const attachment = await prisma.productFeedbackAttachment.findUnique({
    where: { id: params.attachmentId },
    select: { fileName: true, fileUrl: true },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Capture introuvable" }, { status: 404 });
  }

  const url = new URL(req.url);
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(feedbackScreenshotBucketName)
    .createSignedUrl(attachment.fileUrl, SIGNED_URL_TTL_SECONDS, {
      download: url.searchParams.get("download") === "1" ? attachment.fileName : false,
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Impossible de charger la capture" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
