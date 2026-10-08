import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const reset = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return jsonError("Reset link is invalid or expired.", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash, status: "ACTIVE" },
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logActivity({
    actorId: reset.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entity: "User",
    entityId: reset.userId,
  });

  return NextResponse.json({ ok: true });
}
