/**
 * How long a login lasts without using the portal. Each visit restarts it (NextAuth re-issues the
 * JWT cookie), so people who are working stay signed in; a laptop left overnight asks again.
 */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
