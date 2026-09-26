import { projectPublicRelationRequestHistory, type PublicRelationRequestHistoryEvent } from "./public-relation-request-history.ts";

export type RelationRequestView = { id: string; candidateName: string; createdAt: string; status: "PENDING" | "ACCEPTED" | "DECLINED"; decidedAt: string | null; declineReason: string | null; relationCaseId: string | null; message: string; notificationAllowed: boolean; answers: Array<{ label: string; value: string }>; attachments: Array<{ fileName: string }>; history: PublicRelationRequestHistoryEvent[] };

export function projectRelationRequestView(request: any, audits: any[], fieldLabels = new Map<string, string>()): RelationRequestView | null {
  if (!request.requestPayload || typeof request.requestPayload !== "object" || Array.isArray(request.requestPayload)) return null;
  const data = request.requestPayload as Record<string, unknown>;
  if (typeof data.candidateName !== "string" || typeof data.candidateEmail !== "string" || !["PENDING", "ACCEPTED", "DECLINED"].includes(request.status)) return null;
  const submission = data.formSubmission && typeof data.formSubmission === "object" && !Array.isArray(data.formSubmission) ? data.formSubmission as Record<string, unknown> : null;
  const rawAnswers = submission?.answers && typeof submission.answers === "object" && !Array.isArray(submission.answers) ? submission.answers as Record<string, unknown> : {};
  const answers = Object.entries(rawAnswers).map(([key, value]) => ({ label: fieldLabels.get(key) ?? key, value: Array.isArray(value) ? value.join(", ") : value == null ? "" : typeof value === "object" ? "Réponse structurée" : String(value) }));
  const attachments = Array.isArray(data.attachments) ? data.attachments.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && typeof (item as Record<string, unknown>).fileName === "string" ? [{ fileName: String((item as Record<string, unknown>).fileName) }] : []) : [];
  return { id: request.id, candidateName: data.candidateName, createdAt: request.createdAt.toISOString(), status: request.status, decidedAt: request.decidedAt?.toISOString() ?? null, declineReason: request.declineReason, relationCaseId: request.relationCaseId, message: typeof data.message === "string" ? data.message : "", notificationAllowed: data.candidateEmailNotificationsEnabled === true && !/^private-.*@goodissima\.local$/i.test(data.candidateEmail), answers, attachments, history: projectPublicRelationRequestHistory(request, audits) };
}
