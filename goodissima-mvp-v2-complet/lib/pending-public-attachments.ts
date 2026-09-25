import { createHmac, timingSafeEqual } from "node:crypto";
import { RATE_LIMIT_SECRET_ENV } from "./public-request-source.ts";

export const MAX_PENDING_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_PENDING_ATTACHMENTS = 10;

export type PendingPublicAttachment = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type TicketPayload = PendingPublicAttachment & { gLinkId: string; expiresAt: number };

function secret() {
  const value = process.env[RATE_LIMIT_SECRET_ENV];
  if (!value || value.length < 32) throw new Error("RATE_LIMIT_SECRET_UNAVAILABLE");
  return value;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(`pending-attachment:v1:${payload}`).digest("base64url");
}

export function createPendingAttachmentTicket(input: PendingPublicAttachment & { gLinkId: string }, now = Date.now()) {
  const payload = encode(JSON.stringify({ ...input, expiresAt: now + 24 * 60 * 60 * 1000 } satisfies TicketPayload));
  return `${payload}.${signature(payload)}`;
}

export function readPendingAttachmentTickets(values: unknown, gLinkId: string, now = Date.now()) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > MAX_PENDING_ATTACHMENTS) throw new Error("ATTACHMENTS_INVALID");
  return values.map((value): PendingPublicAttachment => {
    if (typeof value !== "string" || value.length > 4096) throw new Error("ATTACHMENTS_INVALID");
    const [payload, suppliedSignature, extra] = value.split(".");
    if (!payload || !suppliedSignature || extra) throw new Error("ATTACHMENTS_INVALID");
    const expected = signature(payload);
    const supplied = Buffer.from(suppliedSignature);
    const expectedBuffer = Buffer.from(expected);
    if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) throw new Error("ATTACHMENTS_INVALID");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TicketPayload;
    if (parsed.gLinkId !== gLinkId || parsed.expiresAt < now || !parsed.storageKey.startsWith(`pending/${gLinkId}/`)) throw new Error("ATTACHMENTS_INVALID");
    if (!parsed.fileName || !parsed.mimeType || !Number.isSafeInteger(parsed.size) || parsed.size < 0 || parsed.size > MAX_PENDING_ATTACHMENT_SIZE) throw new Error("ATTACHMENTS_INVALID");
    return { storageKey: parsed.storageKey, fileName: parsed.fileName, mimeType: parsed.mimeType, size: parsed.size };
  });
}
