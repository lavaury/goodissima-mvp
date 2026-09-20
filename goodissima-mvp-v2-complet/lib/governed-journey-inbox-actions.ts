"use server";

import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { decideReceivedJourneyInvitation } from "@/lib/governed-journey-consent";
import { prisma } from "@/lib/prisma";

async function decide(formData: FormData, decision: "ACCEPTED" | "DECLINED") {
  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) throw new Error("Invitation indisponible.");
  const user = await getCurrentPrismaUser();
  try {
    await decideReceivedJourneyInvitation(prisma, { invitationId, userId: user.id, decision });
    redirect(`/gouvernance/invitations/${encodeURIComponent(invitationId)}?decision=${decision.toLowerCase()}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/gouvernance/invitations/${encodeURIComponent(invitationId)}?decision=unavailable`);
  }
}

export async function acceptReceivedJourneyInvitation(formData: FormData) { return decide(formData, "ACCEPTED"); }
export async function declineReceivedJourneyInvitation(formData: FormData) { return decide(formData, "DECLINED"); }
