import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-auth";
import { generateSecureToken, hoursFromNow } from "@/lib/tokens";
import {
  EmailDeliveryError,
  emailDeliveryConfigured,
  passwordResetEmailHtml,
  sendEmail,
} from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { allowPasswordReset } from "@/lib/security/auth-throttle";
import { clientIp } from "@/lib/security/client-ip";

const schema = z.object({
  email: z.string().email(),
});

/** Generic success — never reveals whether the account exists or returns reset URLs. */
const GENERIC_OK = { ok: true as const };

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const email = parsed.data.email.toLowerCase().trim();

  // Over the limit: same answer as success, but no email (protects inboxes and the Resend quota).
  if (!(await allowPasswordReset(email, clientIp(req.headers)))) {
    return NextResponse.json(GENERIC_OK);
  }
  const user = await prisma.user.findUnique({ where: { email } });

  // Always succeed to avoid account enumeration
  if (!user || user.status === "DISABLED") {
    return NextResponse.json(GENERIC_OK);
  }

  // Without a mail provider we refuse to mint tokens (no alternate disclosure channel).
  if (!emailDeliveryConfigured()) {
    console.error("[forgot-password] RESEND_API_KEY is not configured; reset not sent.");
    return NextResponse.json(GENERIC_OK);
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

  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your Trinity Retail Intelligence password",
      html: passwordResetEmailHtml({ firstName: user.firstName, resetUrl }),
    });
  } catch (err) {
    // Do not leak tokens. Invalidate unused token on delivery failure.
    await prisma.passwordResetToken
      .update({
        where: { token },
        data: { usedAt: new Date() },
      })
      .catch(() => undefined);

    if (err instanceof EmailDeliveryError) {
      console.error("[forgot-password] email delivery failed");
      return NextResponse.json(GENERIC_OK);
    }
    console.error("[forgot-password] unexpected email failure");
    return NextResponse.json(GENERIC_OK);
  }

  await logActivity({
    actorId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entity: "User",
    entityId: user.id,
  });

  return NextResponse.json(GENERIC_OK);
}
