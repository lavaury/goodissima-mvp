export function localDateTimeValue(date = new Date()) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
export function toUtcIso(value: string) { const parsed = new Date(value); if (!value || !Number.isFinite(parsed.getTime())) throw new Error("INVALID_DATE"); return parsed.toISOString(); }
export function memoryQuery(values: Record<string, string | number | undefined>) { const query = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") query.set(key, String(value)); return query.toString(); }

