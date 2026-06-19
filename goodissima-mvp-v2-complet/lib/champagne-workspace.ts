export const champagneWorkspaceRoles = new Set(["ADMIN", "TESTER", "PRODUCT_OWNER", "SUPER_ADMIN"]);

export function canAccessChampagneWorkspace(role: string | null | undefined) {
  return champagneWorkspaceRoles.has((role ?? "").toUpperCase());
}
