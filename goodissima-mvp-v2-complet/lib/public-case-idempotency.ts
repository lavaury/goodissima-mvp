import { createHash, createHmac } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { RATE_LIMIT_SECRET_ENV } from "./public-request-source.ts";

export const PUBLIC_CASE_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_CASE_IDEMPOTENCY_RETRY_AFTER_SECONDS = 2;
export const PUBLIC_CASE_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{22,200}$/;
const CLEANUP_BATCH_SIZE = 100;

type IdempotencyClient = Pick<PrismaClient, "$executeRaw" | "publicCaseCreationRequest">;

export function readPublicCaseIdempotencyKey(headers: Headers) {
  const value = headers.get("idempotency-key");
  if (value === null) return { ok: true as const, key: null };
  if (!PUBLIC_CASE_IDEMPOTENCY_KEY_PATTERN.test(value)) {
    return { ok: false as const, code: "INVALID_IDEMPOTENCY_KEY" };
  }
  return { ok: true as const, key: value };
}

export function hashPublicCaseIdempotencyKey(key: string, secret = process.env[RATE_LIMIT_SECRET_ENV]) {
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_SECRET_UNAVAILABLE");
  return createHmac("sha256", secret).update(`idempotency:v1:${key}`).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalPublicCasePayload(body: Record<string, unknown>) {
  const normalized = { ...body };
  for (const key of [
    "gLinkId", "candidateName", "candidateEmail", "candidateNotificationEmail", "message",
    "documentName", "documentUrl", "formTemplateId", "templateVersionId", "trustAdmissionToken",
  ]) {
    if (typeof normalized[key] === "string") normalized[key] = normalized[key].trim();
  }
  for (const key of ["candidateEmail", "candidateNotificationEmail"]) {
    if (typeof normalized[key] === "string") normalized[key] = normalized[key].toLowerCase();
  }
  return JSON.stringify(canonicalize(normalized));
}

export function hashPublicCasePayload(body: Record<string, unknown>) {
  return createHash("sha256").update(canonicalPublicCasePayload(body)).digest("hex");
}

export async function cleanupExpiredPublicCaseRequests(client: IdempotencyClient, now = new Date()) {
  return client.$executeRaw(Prisma.sql`
    DELETE FROM "PublicCaseCreationRequest"
    WHERE "id" IN (
      SELECT "id" FROM "PublicCaseCreationRequest"
      WHERE "expiresAt" < ${now}
      ORDER BY "expiresAt" ASC
      LIMIT ${CLEANUP_BATCH_SIZE}
    )
  `);
}

export async function reservePublicCaseRequest(client: IdempotencyClient, input: {
  gLinkId: string;
  idempotencyKeyHash: string;
  payloadHash: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await cleanupExpiredPublicCaseRequests(client, now);
  try {
    const request = await client.publicCaseCreationRequest.create({
      data: {
        gLinkId: input.gLinkId,
        idempotencyKeyHash: input.idempotencyKeyHash,
        payloadHash: input.payloadHash,
        expiresAt: new Date(now.getTime() + PUBLIC_CASE_IDEMPOTENCY_TTL_MS),
      },
    });
    return { kind: "RESERVED" as const, request };
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
  }

  const request = await client.publicCaseCreationRequest.findUnique({
    where: { gLinkId_idempotencyKeyHash: { gLinkId: input.gLinkId, idempotencyKeyHash: input.idempotencyKeyHash } },
  });
  if (!request) return reservePublicCaseRequest(client, { ...input, now });
  if (request.payloadHash !== input.payloadHash) return { kind: "CONFLICT" as const, request };
  if (request.status === "COMPLETED" && request.relationCaseId) return { kind: "COMPLETED" as const, request };
  return { kind: "PENDING" as const, request };
}
