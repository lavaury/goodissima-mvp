const REDACTED = "[REDACTED]";
const BASE_URL = "https://feedback.invalid";

function decode(value: string) {
  // Also handle URLs nested/encoded by login redirects. Fail closed on malformed input.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!/%[0-9a-f]{2}/i.test(value)) return value;
    value = decodeURIComponent(value);
  }
  if (/%[0-9a-f]{2}/i.test(value)) throw new Error("Excessive URL encoding");
  return value;
}

function sensitiveKey(key: string) {
  const normalized = decode(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  return /token|secret|password|authorization|credential|signature|apikey/.test(normalized)
    || /^(code|authcode|authorizationcode|codeverifier|codechallenge|otp|auth|jwt|key)$/.test(normalized);
}

function sanitizePath(pathname: string) {
  const path = decode(pathname).replace(/\\/g, "/");
  // Redact the entire tail, including malformed or encoded token separators.
  if (/^\/secure\//i.test(path)) return `/secure/${REDACTED}`;
  if (/^\/gouvernance\/invitation\//i.test(path)) return `/gouvernance/invitation/${REDACTED}`;
  // These API parameters are named [id], but actually carry the guest token.
  return path.replace(
    /^(\/api\/gouvernance\/invitations\/)\S+?(\/media\/(?:attendance|livekit-token|session-usage)\/?$)/i,
    `$1${REDACTED}$2`,
  );
}

function sanitizeParams(query: string, depth: number) {
  const result = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(query)) {
    if (sensitiveKey(key)) {
      result.append(decode(key), REDACTED);
      continue;
    }
    const decoded = decode(value);
    const nestedUrl = /^(?:\/|https?:\/\/)/i.test(decoded);
    const nestedParams = /(?:^|[?&#])[^?&#=]+=/.test(decoded);
    result.append(key, nestedUrl
      ? sanitizeUrl(decoded, depth + 1)
      : nestedParams
        ? (depth >= 4 ? REDACTED : sanitizeParams(decoded, depth + 1))
        : value);
  }
  return result.toString();
}

function sanitizeFragment(fragment: string, depth: number): string {
  const decoded = decode(fragment);
  if (/^(?:\/|https?:\/\/)/i.test(decoded)) return sanitizeUrl(decoded, depth + 1);
  const queryIndex = decoded.indexOf("?");
  if (queryIndex >= 0 && !decoded.slice(0, queryIndex).includes("=")) {
    return `${decoded.slice(0, queryIndex)}?${sanitizeParams(decoded.slice(queryIndex + 1), depth)}`;
  }
  return decoded.includes("=") ? sanitizeParams(decoded, depth) : fragment;
}

function sanitizeUrl(value: string, depth: number): string {
  if (depth > 4) return REDACTED;
  if (!/^(?:\/|https?:\/\/)/i.test(value)) return REDACTED;
  const url = new URL(value, BASE_URL);
  if (url.protocol !== "http:" && url.protocol !== "https:") return REDACTED;
  const pathname = sanitizePath(url.pathname);
  const query = sanitizeParams(url.search, depth);
  const fragment = sanitizeFragment(url.hash.slice(1), depth);
  // Origin/userinfo are unnecessary for route diagnostics and can contain credentials.
  return `${pathname}${query ? `?${query}` : ""}${fragment ? `#${fragment}` : ""}`;
}

/** Central URL-context policy. The feedback API must call this before ALL persistence.
 * Safe to reuse on the client as defense in depth; client input is never trusted.
 * This sanitizes URL context, not user-authored feedback text or screenshots.
 */
export function sanitizeFeedbackUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.length > 16_384) return REDACTED;
  try {
    // Truncate only AFTER removing secrets, for both database and JSONL fallback.
    return sanitizeUrl(value.trim(), 0).slice(0, 300);
  } catch {
    return REDACTED;
  }
}
