import { classifyGLink } from "./business-object-classification.ts";

export type RelationCaseOriginKind = "OPPORTUNITY" | "SIMPLE_LINK" | "UNKNOWN";

type OriginNavigationInput = {
  senderType: "OWNER" | "CANDIDATE";
  gLink: { id: string; slug?: string | null; rules?: unknown };
  originKind?: RelationCaseOriginKind;
};

export function relationCaseOriginNavigation({ senderType, gLink, originKind = "UNKNOWN" }: OriginNavigationInput) {
  const classification = classifyGLink(gLink.rules);
  const resolvedKind = originKind !== "UNKNOWN"
    ? originKind
    : classification === "SIMPLE_LINK"
      ? "SIMPLE_LINK"
      : classification === "MODERN_OPPORTUNITY"
        ? "OPPORTUNITY"
        : "UNKNOWN";
  const label = resolvedKind === "SIMPLE_LINK"
    ? "Voir le lien d'origine"
    : resolvedKind === "OPPORTUNITY"
      ? "Voir l'annonce d'origine"
      : "Voir l'origine";

  if (senderType === "OWNER") {
    return { href: `/links/${encodeURIComponent(gLink.id)}`, label, opensNewTab: false };
  }

  return {
    href: gLink.slug ? `/l/${encodeURIComponent(gLink.slug)}?context=1` : null,
    label,
    opensNewTab: Boolean(gLink.slug),
  };
}
