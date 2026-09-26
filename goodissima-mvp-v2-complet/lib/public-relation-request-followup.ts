import { createHmac, timingSafeEqual } from "node:crypto";
import { RATE_LIMIT_SECRET_ENV } from "./public-request-source.ts";

const DOMAIN = "public-relation-request-follow-up:v1";
type FollowUpClaims = { r: string; g: string; e: number };

function secret() { const value = process.env[RATE_LIMIT_SECRET_ENV]; if (!value || value.length < 32) throw new Error("FOLLOW_UP_SECRET_UNAVAILABLE"); return value; }
function signature(payload: string) { return createHmac("sha256", secret()).update(`${DOMAIN}:${payload}`).digest("base64url"); }

export function createPublicRelationRequestFollowUpToken(input: { requestId: string; gLinkId: string; expiresAt: Date }) {
  const payload = Buffer.from(JSON.stringify({ r: input.requestId, g: input.gLinkId, e: Math.floor(input.expiresAt.getTime() / 1000) } satisfies FollowUpClaims)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyPublicRelationRequestFollowUpToken(token: string, now = new Date()): FollowUpClaims | null {
  try {
    const [payload, suppliedSignature, extra] = token.split("."); if (!payload || !suppliedSignature || extra) return null;
    const expected = Buffer.from(signature(payload)); const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<FollowUpClaims>;
    if (typeof claims.r !== "string" || typeof claims.g !== "string" || typeof claims.e !== "number" || !Number.isSafeInteger(claims.e) || claims.e <= Math.floor(now.getTime() / 1000)) return null;
    return { r: claims.r, g: claims.g, e: claims.e };
  } catch { return null; }
}

export function publicRelationRequestFollowUpUrl(input: { id: string; gLinkId: string; expiresAt: Date }) { return `/demande/${createPublicRelationRequestFollowUpToken({ requestId: input.id, gLinkId: input.gLinkId, expiresAt: input.expiresAt })}`; }
