import { createHash, randomBytes } from "crypto";

export function generateSecureToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

/** What the database stores for an emailed invite/reset token: never the token itself (SHA-256 hex). */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
