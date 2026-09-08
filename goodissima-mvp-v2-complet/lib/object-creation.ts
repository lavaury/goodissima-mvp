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
  const value = rules && typeof rules === "object" && !Array.isArray(rules) ? rules as Record<string, unknown> : {};
  if (value.simpleLink === true) return "Lien simple";
  if (value.creationSource === "opportunity") return "Opportunité";
  return "Lien";
}
