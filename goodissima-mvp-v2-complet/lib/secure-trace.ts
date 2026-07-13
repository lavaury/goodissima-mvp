type SecureTraceData = Record<string, string | number | boolean | null | undefined>;

export function isSecureTraceEnabled() {
  return process.env.GOODISSIMA_SECURE_TRACE === "true" || process.env.GOODISSIMA_DEBUG === "true";
}

export function secureTraceEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.GOODISSIMA_ENV ?? process.env.NODE_ENV ?? "unknown";
}

export async function secureTokenHash(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

export function secureTrace(step: string, data: SecureTraceData = {}) {
  if (!isSecureTraceEnabled()) return;
  console.info("secure_trace", step, data);
}
