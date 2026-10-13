/** Error codes from the credentials sign-in, turned into what the login screens show. Client-safe. */

export const LOCKED_PREFIX = "LOCKED:";

/** Thrown from authorize() so signIn() returns it as `result.error`. */
export function lockedError(retryAfterSeconds: number) {
  return `${LOCKED_PREFIX}${Math.max(0, Math.ceil(retryAfterSeconds))}`;
}

export function loginErrorMessage(error: string | null | undefined, fallback: string) {
  if (!error?.startsWith(LOCKED_PREFIX)) return fallback;
  const seconds = Number(error.slice(LOCKED_PREFIX.length)) || 0;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`;
}
