export type UserRole = "admin" | "user";

export type Permission = "messages:read" | "messages:send" | "messages:delete" | "messages:move";

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  admin: ["messages:read", "messages:send", "messages:delete", "messages:move"],
  user: ["messages:read", "messages:send", "messages:move"]
};

function parseEnvDomains(envVar: string): string[] {
  const value = process.env[envVar];
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks whether the given email address belongs to an allowed domain.
 * When ALLOWED_DOMAINS is not configured, all domains are permitted (open mode).
 */
export function isDomainAllowed(email: string): boolean {
  const allowedDomains = parseEnvDomains("ALLOWED_DOMAINS");

  if (allowedDomains.length === 0) {
    return true;
  }

  const domain = email.split("@").at(1)?.toLowerCase() ?? "";
  return allowedDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

/**
 * Resolves the role for the given email address.
 * Emails whose domain matches any entry in ADMIN_DOMAINS receive the "admin" role.
 * All other authenticated users receive the "user" role.
 */
export function resolveRole(email: string): UserRole {
  const adminDomains = parseEnvDomains("ADMIN_DOMAINS");

  if (adminDomains.length === 0) {
    return "user";
  }

  const domain = email.split("@").at(1)?.toLowerCase() ?? "";
  const isAdmin = adminDomains.some((adminDomain) => domain === adminDomain || domain.endsWith(`.${adminDomain}`));

  return isAdmin ? "admin" : "user";
}

/**
 * Returns true when the given role includes the requested permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (rolePermissions[role] as readonly string[]).includes(permission);
}
