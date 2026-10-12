import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { generateSecureToken, daysFromNow } from "@/lib/tokens";
import {
  EmailDeliveryError,
  emailDeliveryConfigured,
  invitationEmailHtml,
  sendEmail,
} from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { mayExposeSensitiveAuthUrls } from "@/lib/security/expose-sensitive-urls";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  department: z.string().min(1).default("Operations"),
  role: z.enum(["SUPER_ADMIN", "STANDARD_USER"]).default("STANDARD_USER"),
});

export async function POST(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  if (!emailDeliveryConfigured()) {
    return jsonError(
      "Email delivery is not configured. Set RESEND_API_KEY before inviting staff.",
      503
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  if (
    parsed.data.role === "SUPER_ADMIN" &&
    auth.session.user.role !== "SUPER_ADMIN"
  ) {
    return jsonError("Only Super Admins can invite Super Admins.", 403);
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("A user with this email already exists.", 409);

  const user = await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      department: parsed.data.department,
      role: parsed.data.role,
      accountType: "INTERNAL",
      status: "PENDING",
      permissions: "[]",
    },
  });

  const token = generateSecureToken();
  await prisma.invitationToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: daysFromNow(7),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const activateUrl = `${baseUrl}/intelligence/activate?token=${token}`;

  try {
    await sendEmail({
      to: user.email,
      subject: "Welcome to Trinity Retail Intelligence",
      html: invitationEmailHtml({ firstName: user.firstName, activateUrl }),
    });
  } catch (err) {
    await prisma.invitationToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    const message =
      err instanceof EmailDeliveryError ? err.message : "Invitation email could not be sent.";
    return jsonError(message, 503);
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: "STAFF_INVITED",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email },
  });

  const payload: Record<string, unknown> = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      role: user.role,
    },
    invitationSent: true,
  };
  if (mayExposeSensitiveAuthUrls()) {
    payload.activateUrl = activateUrl;
  }

  return NextResponse.json(payload, { status: 201 });
}
