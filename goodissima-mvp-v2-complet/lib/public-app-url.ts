function runtimeName() {
  return (process.env.GOODISSIMA_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
}

function isLocalRuntime(runtime: string) {
  return runtime === "development" || runtime === "local" || runtime === "test";
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isEphemeralVercelHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (!normalized.endsWith(".vercel.app")) return false;
  const label = normalized.slice(0, -".vercel.app".length);
  return label.includes("-git-") || /-[a-z0-9]{8,}-/.test(label) || label.endsWith("-projects");
}

export function validatePublicAppUrl(value: string, runtime = runtimeName()) {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("PUBLIC_APP_URL_INVALID: NEXT_PUBLIC_APP_URL must be an absolute HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("PUBLIC_APP_URL_INVALID_PROTOCOL: NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("PUBLIC_APP_URL_INVALID_CREDENTIALS: credentials are not allowed in NEXT_PUBLIC_APP_URL.");
  }
  if (!isLocalRuntime(runtime) && isLocalHostname(parsed.hostname)) {
    throw new Error("PUBLIC_APP_URL_LOCALHOST_FORBIDDEN: localhost is allowed only in local or test environments.");
  }
  if (!isLocalRuntime(runtime) && isEphemeralVercelHostname(parsed.hostname)) {
    throw new Error("PUBLIC_APP_URL_EPHEMERAL_VERCEL_FORBIDDEN: configure a stable canonical domain.");
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

export function getPublicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const runtime = runtimeName();
  if (configured) return validatePublicAppUrl(configured, runtime);
  if (isLocalRuntime(runtime)) return "http://localhost:3000";
  throw new Error("PUBLIC_APP_URL_MISSING: NEXT_PUBLIC_APP_URL is required outside local development.");
}

export function buildPublicAppUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${getPublicAppUrl()}/`).toString();
}
