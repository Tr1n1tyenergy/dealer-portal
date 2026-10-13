/**
 * Root Super Admin accounts that must not be deleted except by the primary admin.
 */

export const PRIMARY_SUPER_ADMIN_EMAIL = "admin@trinityenergyltd.com";

/** Accounts that only PRIMARY_SUPER_ADMIN_EMAIL may delete. */
export const PROTECTED_SUPER_ADMIN_EMAILS = [
  PRIMARY_SUPER_ADMIN_EMAIL,
  "executive.admin@trinityenergyltd.com",
] as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isProtectedSuperAdminEmail(email: string) {
  const normalized = normalizeEmail(email);
  return (PROTECTED_SUPER_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

export function isPrimarySuperAdminEmail(email: string) {
  return normalizeEmail(email) === PRIMARY_SUPER_ADMIN_EMAIL;
}

/** True when actor may delete the target user given protected-admin rules. */
export function mayDeleteProtectedAdmin(actorEmail: string, targetEmail: string) {
  if (!isProtectedSuperAdminEmail(targetEmail)) return true;
  return isPrimarySuperAdminEmail(actorEmail);
}
