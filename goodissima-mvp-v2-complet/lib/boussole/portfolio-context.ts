import type { BoussoleRuntimeContext } from "./contracts.ts";
import { resolveBoussolePageState } from "./page-state.ts";

/** A route alone cannot establish a real focused object: its rendered target must exist. */
export function portfolioRuntimeContext(contextId: string | undefined, pathname: string, targets: string[]): BoussoleRuntimeContext | null {
  if (contextId === "portfolio") {
    const visibleObjectCount = targets.includes("first-portfolio-card") ? 1 : 0;
    return { pageState: resolveBoussolePageState({ visibleObjectCount }), visibleObjectCount };
  }
  if (contextId !== "portfolio-detail" && contextId !== "portfolio-pilotage") return null;
  const target = contextId === "portfolio-detail" ? "portfolio-detail-overview" : "portfolio-pilotage-overview";
  const match = pathname.match(/^\/gouvernance\/portfolios\/([^/]+)(?:\/pilotage)?\/?$/);
  const focusedObjectId = targets.includes(target) && match && match[1] !== "nouveau" ? match[1] : undefined;
  return { pageState: resolveBoussolePageState({ focusedObjectId, visibleObjectCount: 0 }),
    focusedObjectId, focusedObjectType: focusedObjectId ? "PORTFOLIO" : undefined, visibleObjectCount: focusedObjectId ? 1 : 0 };
}
