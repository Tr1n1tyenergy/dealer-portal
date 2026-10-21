import { prisma } from "@/lib/prisma";
import { daysFromNow, generateSecureToken } from "@/lib/tokens";
import { EmailDeliveryError, invitationEmailHtml, sendEmail } from "@/lib/email";

const PORTAL = {
  INTERNAL: { path: "/intelligence/activate", subject: "Welcome to Trinity Retail Intelligence" },
  DEALER: { path: "/dealer/activate", subject: "Activate your Trinity Dealer Portal account" },
} as const;

type Target = { id: string; email: string; firstName: string; accountType: string };

/**
 * Email a fresh activation link for the person's own portal. The account is reset (password
 * cleared, PENDING, older links removed) only after the email went out, so a failed send changes nothing.
 */
export async function resendInvite(
  user: Target,
): Promise<{ ok: true; activateUrl: string } | { ok: false; message: string }> {
  const portal = PORTAL[user.accountType as keyof typeof PORTAL];
  if (!portal) return { ok: false, message: "Depot accounts are set up by an Admin script, not by invitation." };

  const token = generateSecureToken();
  await prisma.invitationToken.create({ data: { token, userId: user.id, expiresAt: daysFromNow(7) } });
  const activateUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${portal.path}?token=${token}`;

  try {
    await sendEmail({
      to: user.email,
      subject: portal.subject,
      html: invitationEmailHtml({ firstName: user.firstName, activateUrl }),
    });
  } catch (err) {
    await prisma.invitationToken.deleteMany({ where: { token } });
    return { ok: false, message: err instanceof EmailDeliveryError ? err.message : "Invitation email could not be sent." };
  }

  await prisma.$transaction([
    prisma.invitationToken.deleteMany({ where: { userId: user.id, token: { not: token } } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: null, status: "PENDING" } }),
  ]);
  return { ok: true, activateUrl };
}
