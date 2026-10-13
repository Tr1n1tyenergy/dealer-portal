/**
 * Sign-in lockout and password-reset limits (E1). Counts live in the AuthAttempt table because
 * serverless instances do not share memory.
 */
import type { AuthAttemptKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const LOGIN_EMAIL_LIMIT = 5;
export const LOGIN_IP_LIMIT = 30;
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const RESET_EMAIL_LIMIT = 3;
export const RESET_IP_LIMIT = 10;
export const RESET_WINDOW_MS = 60 * 60_000;
const RETENTION_MS = 24 * 3_600_000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Seconds until fewer than `limit` attempts remain in the window, or 0 when under the limit.
 * Measured from the oldest of the most recent `limit` attempts.
 */
async function secondsUntilUnder(
  kind: AuthAttemptKind,
  where: { email: string } | { ip: string },
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const recent = await prisma.authAttempt.findMany({
    where: { kind, ...where, createdAt: { gte: new Date(now - windowMs) } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { createdAt: true },
  });
  if (recent.length < limit) return 0;
  const oldest = recent[recent.length - 1].createdAt.getTime();
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

async function record(kind: AuthAttemptKind, email: string, ip: string) {
  const row = await prisma.authAttempt.create({ data: { kind, email: normalizeEmail(email), ip } });
  await prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });
  return row;
}

function countSince(kind: AuthAttemptKind, where: { email: string } | { ip: string }, windowMs: number) {
  return prisma.authAttempt.count({ where: { kind, ...where, createdAt: { gte: new Date(Date.now() - windowMs) } } });
}

/**
 * Record first, then count: a burst of simultaneous requests all see each other's rows, so at most
 * `limit` of them get through. A request over the limit removes its own row (refusals aren't counted).
 */
async function claim(
  kind: AuthAttemptKind,
  email: string,
  ip: string,
  limits: { email: number; ip: number; windowMs: number }
) {
  const row = await record(kind, email, ip);
  const [byEmail, byIp] = await Promise.all([
    countSince(kind, { email: row.email }, limits.windowMs),
    countSince(kind, { ip }, limits.windowMs),
  ]);
  if (byEmail <= limits.email && byIp <= limits.ip) return true;
  await prisma.authAttempt.delete({ where: { id: row.id } }).catch(() => undefined);
  return false;
}

export async function checkLoginLock(
  email: string,
  ip: string
): Promise<{ locked: false } | { locked: true; retryAfterSeconds: number }> {
  const [byEmail, byIp] = await Promise.all([
    secondsUntilUnder("LOGIN_FAILURE", { email: normalizeEmail(email) }, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS),
    secondsUntilUnder("LOGIN_FAILURE", { ip }, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS),
  ]);
  const wait = Math.max(byEmail, byIp);
  return wait > 0 ? { locked: true, retryAfterSeconds: wait } : { locked: false };
}

/**
 * Start a sign-in: records it as a failure up front (cleared by clearLoginFailures on success) and
 * reports a lock when this attempt would go over the limit. Call before checking the password.
 */
export async function beginLoginAttempt(
  email: string,
  ip: string
): Promise<{ locked: false } | { locked: true; retryAfterSeconds: number }> {
  const allowed = await claim("LOGIN_FAILURE", email, ip, {
    email: LOGIN_EMAIL_LIMIT,
    ip: LOGIN_IP_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
  });
  if (allowed) return { locked: false };
  const lock = await checkLoginLock(email, ip);
  return { locked: true, retryAfterSeconds: lock.locked ? lock.retryAfterSeconds : 1 };
}

export function recordLoginFailure(email: string, ip: string) {
  return record("LOGIN_FAILURE", email, ip);
}

export async function clearLoginFailures(email: string) {
  await prisma.authAttempt.deleteMany({ where: { kind: "LOGIN_FAILURE", email: normalizeEmail(email) } });
}

/** Records the request and returns true while under both reset limits. */
export function allowPasswordReset(email: string, ip: string) {
  return claim("PASSWORD_RESET", email, ip, {
    email: RESET_EMAIL_LIMIT,
    ip: RESET_IP_LIMIT,
    windowMs: RESET_WINDOW_MS,
  });
}
