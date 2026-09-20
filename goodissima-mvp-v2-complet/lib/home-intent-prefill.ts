import type { HomeIntent } from "./home-intent.ts";

const key = "goodissima:home-intent-prefill-v1";
const ttlMs = 10 * 60_000;
type Prefill = { intent: HomeIntent; text: string; createdAt: number };

/** One-use, tab-local handoff. No free-text need is placed in a URL or server store. */
export function saveHomeIntentPrefill(intent: HomeIntent, text: string) {
  if (typeof window === "undefined" || !text.trim()) return;
  try { window.sessionStorage.setItem(key, JSON.stringify({ intent, text: text.trim().slice(0, 500), createdAt: Date.now() } satisfies Prefill)); }
  catch { /* Storage may be disabled; navigation still works without prefill. */ }
}

export function consumeHomeIntentPrefill(intent: HomeIntent): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    window.sessionStorage.removeItem(key);
    const value = JSON.parse(raw) as Partial<Prefill>;
    if (value.intent !== intent) return null;
    return typeof value.text === "string" && value.text.length <= 500 && typeof value.createdAt === "number" && Date.now() - value.createdAt <= ttlMs ? value.text : null;
  } catch { window.sessionStorage.removeItem(key); return null; }
}
