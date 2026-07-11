import { isProductionRuntime } from "@/lib/ai-runtime";

export function isGoodissimaDebugMode() {
  return process.env.GOODISSIMA_DEBUG_MODE === "true" && !isProductionRuntime();
}

export function isDemoSurfaceEnabled() {
  return !isProductionRuntime() && (process.env.GOODISSIMA_DEMO_SURFACES_ENABLED === "true" || isGoodissimaDebugMode());
}
