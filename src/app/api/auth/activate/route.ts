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

  const invite = await prisma.invitationToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
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
