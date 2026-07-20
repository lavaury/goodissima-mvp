type SimpleLinkField = { key?: string | null; type?: string | null };

const relationalEmailKeys = new Set(["email", "candidateemail", "contactemail"]);

export function isSimpleLinkRelationalEmailField(field: SimpleLinkField) {
  const key = field.key?.trim().toLowerCase() ?? "";
  return field.type?.trim().toUpperCase() === "EMAIL" || relationalEmailKeys.has(key);
}

export function isSimpleLink(rules: unknown) {
  return Boolean(rules && typeof rules === "object" && !Array.isArray(rules) && (rules as Record<string, unknown>).simpleLink === true);
}
