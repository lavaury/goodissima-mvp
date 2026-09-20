// Central policy: future grants must be resolved here, never from UI subscription checks.
export function canAccessAIValue(role: string | null | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
