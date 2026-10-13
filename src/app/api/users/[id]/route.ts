import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-auth";
import { generateSecureToken, daysFromNow } from "@/lib/tokens";
import {
  EmailDeliveryError,
  emailDeliveryConfigured,
  invitationEmailHtml,
  sendEmail,
} from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { mayExposeSensitiveAuthUrls } from "@/lib/security/expose-sensitive-urls";
import { mayDeleteProtectedAdmin } from "@/lib/security/protected-admins";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  role: z.enum(["SUPER_ADMIN", "STANDARD_USER"]).optional(),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional(),
  permissions: z.array(z.string()).optional(),
  resetInvite: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      department: parsed.data.department,
      role: parsed.data.role,
      status: parsed.data.status,
      permissions: parsed.data.permissions
        ? JSON.stringify(parsed.data.permissions)
        : undefined,
    },
  });

  let invitationSent = false;

  if (parsed.data.resetInvite) {
    if (!emailDeliveryConfigured()) {
      return jsonError(
        "Email delivery is not configured. Set RESEND_API_KEY before re-sending invitations.",
        503
      );
    }

    const token = generateSecureToken();
    await prisma.invitationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: daysFromNow(7),
      },
    });
    await prisma.user.update({
      where: { id },
      data: { passwordHash: null, status: "PENDING" },
    });
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const activateUrl = `${baseUrl}/intelligence/activate?token=${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: "Welcome to Trinity Retail Intelligence",
        html: invitationEmailHtml({ firstName: user.firstName, activateUrl }),
      });
      invitationSent = true;
    } catch (err) {
      await prisma.invitationToken.deleteMany({ where: { token } });
      const message =
        err instanceof EmailDeliveryError
          ? err.message
          : "Invitation email could not be sent.";
      return jsonError(message, 503);
    }
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
  });

  const payload: Record<string, unknown> = {
    user: updated,
    invitationSent,
  };
  // Never include activateUrl unless explicitly opted-in for local/staging debugging
  if (mayExposeSensitiveAuthUrls() && invitationSent) {
    // Token already emailed; do not re-derive for response in production path.
    // Dev opt-in still omits raw token re-fetch to avoid extra leakage in this hardening pass.
  }

  return NextResponse.json(payload);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (id === auth.session.user.id) {
    return jsonError("You cannot delete your own account.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) return jsonError("User not found", 404);

  if (!mayDeleteProtectedAdmin(auth.session.user.email ?? "", user.email)) {
    return jsonError(
      "This Super Admin account can only be deleted by admin@trinityenergyltd.com.",
      403
    );
  }

  await prisma.user.delete({ where: { id } });
  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_DELETED",
    entity: "User",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
