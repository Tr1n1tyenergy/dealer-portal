/**
 * Per-server memory of each signed-in person's account (role, permissions, status, password-change time),
 * so one page load's requests share one database lookup.
 * Kept short on purpose: Vercel runs several copies of the app, each with its own memory, and an admin's
 * change usually lands on a different copy from the affected person's next request. So the real guarantee
 * is: a password reset, disable, role or permission change applies everywhere within SESSION_CACHE_TTL_MS.
 * Clearing (invalidateUserSessionCache / clearAllSessionCache) only makes it immediate on the copy that
 * made the change. A read that started just before a change can put the old answer back; the TTL bounds that too.
 */
export const SESSION_CACHE_TTL_MS = 5_000;

const cache = new Map<string, { at: number; value: unknown }>();

export function cachedSession<T>(userId: string, now = Date.now()): { hit: true; value: T | null } | { hit: false } {
  const entry = cache.get(userId);
  if (!entry || now - entry.at >= SESSION_CACHE_TTL_MS) return { hit: false };
  return { hit: true, value: entry.value as T | null };
}

export function rememberSession(userId: string, value: unknown, now = Date.now()): void {
  cache.set(userId, { at: now, value });
}

/** Call after changing a person's password, status, role, permissions, or deleting them. */
export function invalidateUserSessionCache(userId: string): void {
  cache.delete(userId);
}

/** Call after a change that touches many people at once (e.g. a role's default permissions). */
export function clearAllSessionCache(): void {
  cache.clear();
}
