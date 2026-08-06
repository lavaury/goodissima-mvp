import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { GovernedMemoryTransitionType } from "@prisma/client";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const normalizeTransitionRequestKey = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return uuidV4.test(normalized) ? normalized : null;
};

export function buildTransitionFingerprint(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify({ contractVersion: 1, ...input }), "utf8").digest("hex");
}

export function fingerprintsEqual(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function buildCockpitPublicMemoryKey(type: "FACT" | "DECISION", id: string) {
  return createHash("sha256").update(`governed-memory-cockpit:v1:${type}:${id}`, "utf8").digest("hex");
}

const tokenSecret = () => {
  const secret = process.env.GOVERNED_MEMORY_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("GOVERNED_MEMORY_TOKEN_SECRET_MISSING");
  return secret;
};

export function buildPublicJourneyMemoryRoleKey(input: { governedJourneyId: string; userId: string; role: "MEMORY_STEWARD" | "MEMORY_DELEGATE" }) {
  return createHmac("sha256", tokenSecret()).update(`journey-memory-role:v1:${input.governedJourneyId}:${input.userId}:${input.role}`, "utf8").digest("hex");
}
export function buildMemoryConcurrencyToken(input: { id: string; updatedAt: Date; type: "FACT" | "DECISION"; governedJourneyId: string }) {
  const payload = Buffer.from(JSON.stringify({ v: 1, i: input.id, u: input.updatedAt.toISOString(), t: input.type, j: input.governedJourneyId }), "utf8").toString("base64url");
  const signature = createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function buildMemoryConcurrencyTokenForCapability(enabled: boolean, input: { id: string; updatedAt: Date; type: "FACT" | "DECISION"; governedJourneyId: string }) {
  return enabled ? buildMemoryConcurrencyToken(input) : null;
}

export function verifyMemoryConcurrencyToken(value: unknown, expected: { id: string; updatedAt: Date; type: "FACT" | "DECISION"; governedJourneyId: string }) {
  if (typeof value !== "string" || value.length > 1000) return false;
  const [payload, signature, extra] = value.split("."); if (!payload || !signature || extra) return false;
  const actual = createHmac("sha256", tokenSecret()).update(payload).digest();
  let provided: Buffer; try { provided = Buffer.from(signature, "base64url"); } catch { return false; }
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.v === 1 && decoded.i === expected.id && decoded.u === expected.updatedAt.toISOString() && decoded.t === expected.type && decoded.j === expected.governedJourneyId;
  } catch { return false; }
}

export const transitionFinalStateLabel: Record<GovernedMemoryTransitionType, string> = {
  ESTABLISH_FACT: "Fait établi", DISPUTE_FACT: "Contestation ouverte", VALIDATE_DECISION: "Décision validée",
  GRANT_JOURNEY_MEMORY_ROLE: "Fonction mémoire active", REVOKE_JOURNEY_MEMORY_ROLE: "Fonction mémoire révoquée",
};
