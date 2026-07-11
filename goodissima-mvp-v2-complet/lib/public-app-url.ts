function normalize(value: string) { return value.trim().replace(/\/+$/, ""); }
export function getPublicAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) return normalize(process.env.NEXT_PUBLIC_APP_URL);
  const vercelEnvironment = process.env.VERCEL_ENV?.toLowerCase();
  if (process.env.VERCEL_URL?.trim() && (vercelEnvironment === "preview" || vercelEnvironment === "production")) return `https://${normalize(process.env.VERCEL_URL)}`;
  const runtime = (process.env.GOODISSIMA_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
  if (runtime === "development" || runtime === "local" || runtime === "test") return "http://localhost:3000";
  throw new Error("PUBLIC_APP_URL_MISSING: NEXT_PUBLIC_APP_URL is required outside local development.");
}
