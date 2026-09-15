export function equivalentJourneyText(left: string, right: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b) && (a === b || a.includes(b) || b.includes(a));
}
