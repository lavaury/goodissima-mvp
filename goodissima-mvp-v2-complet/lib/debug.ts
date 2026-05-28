import { isProductionRuntime } from "@/lib/ai-runtime";

export function isGoodissimaDebugMode() {
  return process.env.GOODISSIMA_DEBUG_MODE === "true" && !isProductionRuntime();
}
