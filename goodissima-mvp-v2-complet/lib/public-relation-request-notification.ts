import type { PrismaClient } from "@prisma/client";
import { sendRelationRequestAcceptedEmail, sendRelationRequestDeclinedEmail } from "@/lib/email";

export type RelationRequestNotificationStatus = "SENT" | "SKIPPED_NO_CONSENT" | "FAILED";
function eligibleNotificationEmail(email: string, consent: boolean) { return consent && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/^private-.*@goodissima\.local$/i.test(email); }

export async function notifyPublicRelationRequestDecision(client: PrismaClient, input: { requestId: string; actorUserId: string; actorEmail: string; decision: "ACCEPTED" | "DECLINED" }): Promise<RelationRequestNotificationStatus> {
  const request = await client.publicCaseCreationRequest.findFirst({ where: { id: input.requestId, status: input.decision, decidedByUserId: input.actorUserId, gLink: { ownerId: input.actorUserId } }, include: { gLink: { select: { title: true, slug: true } }, relationCase: { select: { candidateAccessToken: true } } } });
  if (!request || !request.requestPayload || typeof request.requestPayload !== "object" || Array.isArray(request.requestPayload)) throw new Error("RELATION_REQUEST_NOT_FOUND");
  const data = request.requestPayload as Record<string, unknown>; const email = typeof data.candidateEmail === "string" ? data.candidateEmail : "";
  let status: RelationRequestNotificationStatus = "SKIPPED_NO_CONSENT";
  if (eligibleNotificationEmail(email, data.candidateEmailNotificationsEnabled === true)) {
    try { const delivery = input.decision === "ACCEPTED" && request.relationCase ? await sendRelationRequestAcceptedEmail({ to: email, linkTitle: request.gLink.title, candidateAccessToken: request.relationCase.candidateAccessToken }) : await sendRelationRequestDeclinedEmail({ to: email, linkTitle: request.gLink.title, declineReason: request.declineReason!, publicLinkSlug: request.gLink.slug }); status = delivery.ok ? "SENT" : "FAILED"; } catch { status = "FAILED"; }
  }
  await client.auditLog.create({ data: { actorEmail: input.actorEmail, eventType: `RELATION_REQUEST_DECISION_NOTIFICATION_${status === "SKIPPED_NO_CONSENT" ? "SKIPPED" : status}`, metadata: { requestId: request.id, decision: input.decision, channel: "EMAIL", status } } });
  return status;
}
