import { isOpportunityRules, isSimpleLinkRules } from "./opportunities/opportunity-projection.ts";

/** Missing context is global. An explicitly malformed context is never global. */
export function parseCreationWorkspaceId(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error("Workspace invalide.");
  return value.trim();
}

export function withCreationWorkspace(href: string, workspaceId?: string | null) {
  if (!workspaceId) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}workspaceId=${encodeURIComponent(workspaceId)}${hash ? `#${hash}` : ""}`;
}

export function linkObjectLabel(rules: unknown): "Lien simple" | "Opportunité" | "Lien" {
  if (isSimpleLinkRules(rules)) return "Lien simple";
  if (isOpportunityRules(rules)) return "Opportunité";
  return "Lien";
}
