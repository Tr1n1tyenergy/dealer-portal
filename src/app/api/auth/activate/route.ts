import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { validatePasswordStrength } from "@/lib/security/password-policy";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(1).max(200),
});

/** Lookup invite email for activate UI (read-only; no secrets). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token.length < 10) return jsonError("Invalid token", 400);

  const invite = await prisma.invitationToken.findUnique({
    where: { token },
    include: { user: { select: { email: true, accountType: true, firstName: true } } },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return jsonError("Invitation is invalid or expired.", 400);
  }

  return NextResponse.json({
    email: invite.user.email,
    accountType: invite.user.accountType,
    firstName: invite.user.firstName,
  });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const strength = validatePasswordStrength(parsed.data.password);
  if (!strength.ok) return jsonError(strength.message, 400);

  const invite = await prisma.invitationToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  // A disabled account stays disabled, even with an invite issued before it was disabled.
  if (!invite || invite.usedAt || invite.expiresAt < new Date() || invite.user.status === "DISABLED") {
    return jsonError("Invitation is invalid or expired.", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: invite.userId },
      data: {
        passwordHash,
        status: "ACTIVE",
      },
    }),
    prisma.invitationToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logActivity({
    actorId: invite.userId,
    action: "ACCOUNT_ACTIVATED",
    entity: "User",
    entityId: invite.userId,
  });

  return NextResponse.json({ ok: true });
}
