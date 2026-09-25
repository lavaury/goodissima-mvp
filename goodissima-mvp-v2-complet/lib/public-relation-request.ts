import { Prisma, RelationStatus, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const createCandidateAccessToken = () => randomBytes(32).toString("hex");
const createCandidateAccessExpiresAt = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

export type PublicRelationRequestPayload = {
  candidateName: string;
  candidateEmail: string;
  candidateEmailNotificationsEnabled: boolean;
  message: string;
  documentName: string;
  documentUrl: string;
  attachments?: Array<{ storageKey: string; fileName: string; mimeType: string; size: number }>;
  relationTemplateId: string | null;
  formSubmission: { formTemplateId: string; answers: Record<string, unknown> } | null;
};

function payload(value: Prisma.JsonValue | null): PublicRelationRequestPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("RELATION_REQUEST_INVALID");
  const item = value as Record<string, unknown>;
  if (typeof item.candidateName !== "string" || typeof item.candidateEmail !== "string") throw new Error("RELATION_REQUEST_INVALID");
  return item as PublicRelationRequestPayload;
}

export async function acceptPublicRelationRequest(client: PrismaClient, input: { requestId: string; actorUserId: string; actorEmail: string }) {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`public-relation-request:${input.requestId}`}, 0))`;
    const request = await tx.publicCaseCreationRequest.findUnique({
      where: { id: input.requestId },
      include: { gLink: { select: { id: true, ownerId: true, title: true } } },
    });
    if (!request || request.gLink.ownerId !== input.actorUserId) throw new Error("RELATION_REQUEST_NOT_FOUND");
    if (request.status === "ACCEPTED" && request.relationCaseId) return { requestId: request.id, relationCaseId: request.relationCaseId, replayed: true };
    if (request.status !== "PENDING" || request.relationCaseId) throw new Error("RELATION_REQUEST_NOT_PENDING");
    const data = payload(request.requestPayload);
    const identityId = request.requesterIdentityId ?? (await tx.goodissimaIdentity.create({ data: { type: "PERSON", status: "UNVERIFIED" }, select: { id: true } })).id;
    const relationCase = await tx.relationCase.create({ data: {
      gLinkId: request.gLinkId, ownerId: request.gLink.ownerId, templateId: data.relationTemplateId,
      candidateIdentityId: identityId, candidateAccessToken: createCandidateAccessToken(),
      candidateAccessExpiresAt: createCandidateAccessExpiresAt(), candidateName: data.candidateName,
      candidateEmail: data.candidateEmail, candidateEmailNotificationsEnabled: data.candidateEmailNotificationsEnabled,
      status: RelationStatus.NEW,
    }, select: { id: true } });
    if (data.message) await tx.message.create({ data: { caseId: relationCase.id, senderType: "CANDIDATE", senderEmail: data.candidateEmail, body: data.message } });
    if (data.documentName && data.documentUrl) await tx.document.create({ data: { caseId: relationCase.id, uploadedByEmail: data.candidateEmail, fileName: data.documentName, fileUrl: data.documentUrl, mimeType: "application/octet-stream" } });
    if (data.attachments?.length) await tx.document.createMany({ data: data.attachments.map((attachment) => ({ caseId: relationCase.id, uploadedByEmail: data.candidateEmail, fileName: attachment.fileName, fileUrl: attachment.storageKey, mimeType: attachment.mimeType })) });
    const decidedAt = new Date();
    await tx.publicCaseCreationRequest.update({ where: { id: request.id }, data: { status: "ACCEPTED", relationCaseId: relationCase.id, decidedAt, decidedByUserId: input.actorUserId } });
    await tx.auditLog.create({ data: { caseId: relationCase.id, actorEmail: input.actorEmail, eventType: "RELATION_REQUEST_ACCEPTED", metadata: { requestId: request.id } } });
    return { requestId: request.id, relationCaseId: relationCase.id, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function declinePublicRelationRequest(client: PrismaClient, input: { requestId: string; actorUserId: string; actorEmail: string; reason?: string }) {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`public-relation-request:${input.requestId}`}, 0))`;
    const request = await tx.publicCaseCreationRequest.findUnique({ where: { id: input.requestId }, include: { gLink: { select: { ownerId: true } } } });
    if (!request || request.gLink.ownerId !== input.actorUserId) throw new Error("RELATION_REQUEST_NOT_FOUND");
    if (request.status === "DECLINED") return { requestId: request.id, replayed: true };
    if (request.status !== "PENDING" || request.relationCaseId) throw new Error("RELATION_REQUEST_NOT_PENDING");
    await tx.publicCaseCreationRequest.update({ where: { id: request.id }, data: { status: "DECLINED", decidedAt: new Date(), decidedByUserId: input.actorUserId, declineReason: input.reason?.trim().slice(0, 500) || null } });
    await tx.auditLog.create({ data: { actorEmail: input.actorEmail, eventType: "RELATION_REQUEST_DECLINED", metadata: { requestId: request.id } } });
    return { requestId: request.id, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
