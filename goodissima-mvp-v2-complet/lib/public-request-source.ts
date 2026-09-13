import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const RATE_LIMIT_SECRET_ENV = "RATE_LIMIT_HMAC_SECRET";
const SOURCE_KEY_VERSION = "v1";

function singleHeaderValue(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && !trimmed.includes(",") ? trimmed : null;
}

export function normalizePublicRequestSource(value: string) {
  let candidate = value.trim().toLowerCase();
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else {
    const ipv4WithPort = candidate.match(/^([^:]+):(\d+)$/);
    if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) candidate = ipv4WithPort[1];
  }

  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version === 6) {
    try {
      return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
    } catch {
      return null;
    }
  }
  return null;
}

export function getPublicRequestSource(headers: Headers) {
  const vercel = singleHeaderValue(headers.get("x-vercel-forwarded-for"));
  const forwarded = singleHeaderValue(headers.get("x-forwarded-for"));
  return normalizePublicRequestSource(vercel ?? forwarded ?? "") ?? "unknown";
}

export function pseudonymizePublicRequestSource(source: string, secret = process.env[RATE_LIMIT_SECRET_ENV]) {
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_SECRET_UNAVAILABLE");
  return createHmac("sha256", secret).update(`${SOURCE_KEY_VERSION}:${source}`).digest("hex").slice(0, 32);
}

export function pseudonymizePublicRateLimitKey(namespace: "glink" | "owner", value: string, secret = process.env[RATE_LIMIT_SECRET_ENV]) {
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_SECRET_UNAVAILABLE");
  return createHmac("sha256", secret).update(`${SOURCE_KEY_VERSION}:${namespace}:${value}`).digest("hex").slice(0, 32);
}
