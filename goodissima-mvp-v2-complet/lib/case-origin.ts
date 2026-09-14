import { opportunityOwnerHref, type OpportunityGLinkInput } from "./opportunities/opportunity-projection.ts";

export function relationCaseOriginLabel(gLinkTitle: string | null | undefined) {
  const title = gLinkTitle?.trim();
  return title ? `Réponse à « ${title} »` : "Via un lien partagé";
}

export function relationCaseOriginHref(
  ownerId: string,
  gLink: (OpportunityGLinkInput & { id: string; ownerId: string }) | null | undefined,
) {
  return gLink?.ownerId === ownerId ? opportunityOwnerHref(gLink) : null;
}
