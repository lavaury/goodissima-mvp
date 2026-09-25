export const privatePlatformAccessRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export function canManagePrivatePlatformAccess(user: { role?: string | null } | null | undefined) {
  return Boolean(user?.role && privatePlatformAccessRoles.has(user.role));
}
