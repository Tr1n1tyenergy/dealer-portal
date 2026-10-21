/**
 * How long a login lasts without using the portal. Each visit restarts it (NextAuth re-issues the
 * JWT cookie), so people who are working stay signed in; a laptop left overnight asks again.
 */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * A session may continue only if it signed in after the account's last password change, so a
 * reset ends every other session. No change on record → keep; no sign-in time (older token) → end.
 */
export function signedInAfterPasswordChange(loginAtMs: number | undefined, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return true;
  return loginAtMs !== undefined && loginAtMs >= passwordChangedAt.getTime();
}
