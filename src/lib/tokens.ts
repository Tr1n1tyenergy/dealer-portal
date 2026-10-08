import { randomBytes } from "crypto";

export function generateSecureToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
