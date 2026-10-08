import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-auth";
import { generateSecureToken, hoursFromNow } from "@/lib/tokens";
import { passwordResetEmailHtml, sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always succeed to avoid account enumeration
  if (!user || user.status === "DISABLED") {
    return NextResponse.json({ ok: true });
  }

  const token = generateSecureToken();
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: hoursFromNow(1),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/intelligence/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Trinity Retail Intelligence password",
    html: passwordResetEmailHtml({ firstName: user.firstName, resetUrl }),
  });

  await logActivity({
    actorId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entity: "User",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true, resetUrl: process.env.RESEND_API_KEY ? undefined : resetUrl });
}
