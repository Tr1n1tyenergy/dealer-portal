import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { validatePasswordStrength } from "@/lib/security/password-policy";
import { clearLoginFailures } from "@/lib/security/auth-throttle";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { loginPathFor } from "@/lib/security/login-path";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const strength = validatePasswordStrength(parsed.data.password);
  if (!strength.ok) return jsonError(strength.message, 400);

  const reset = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return jsonError("Reset link is invalid or expired.", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash, status: "ACTIVE", passwordChangedAt: new Date() },
      select: { email: true, accountType: true },
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // The lock message tells people to reset their password, so a reset has to lift it.
  await clearLoginFailures(user.email);

  await logActivity({
    actorId: reset.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entity: "User",
    entityId: reset.userId,
  });

  // Each portal only accepts its own accounts, so send the user back to theirs.
  return NextResponse.json({ ok: true, loginPath: loginPathFor(user.accountType) });
}
