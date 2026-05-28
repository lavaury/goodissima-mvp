import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";

export async function POST() {
  try {
    const owner = await getCurrentPrismaUser();
    const result = await sendTestEmail(owner.email);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "Email not sent" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[email] Test email route failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ ok: false, error: "Unable to send test email" }, { status: 500 });
  }
}
