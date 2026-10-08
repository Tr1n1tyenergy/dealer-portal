/**
 * Shared password policy for activation, reset, and production bootstrap.
 */

const BLOCKED_PASSWORDS = new Set(
  [
    "password",
    "password123",
    "changeme",
    "changemesecurely!",
    "trinityadmin2026!",
    "dealerdemo2026!",
    "depotdemo2026!",
    "trinitydealer2026!",
    "admin123",
    "welcome1",
  ].map((s) => s.toLowerCase())
);

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

export function validatePasswordStrength(password: string): PasswordPolicyResult {
  if (typeof password !== "string" || password.length < 12) {
    return { ok: false, message: "Password must be at least 12 characters." };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password must be at most 128 characters." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, message: "Password must include a lowercase letter." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Password must include an uppercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Password must include a number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: "Password must include a symbol or punctuation character." };
  }
  if (BLOCKED_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: "Password is too common or matches a blocked default." };
  }
  return { ok: true };
}

export function assertPasswordStrength(password: string): void {
  const result = validatePasswordStrength(password);
  if (!result.ok) throw new Error(result.message);
}
