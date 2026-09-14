export function relationCaseOriginLabel(gLinkTitle: string | null | undefined) {
  const title = gLinkTitle?.trim();
  return title ? `Réponse à « ${title} »` : "Via un lien partagé";
}
