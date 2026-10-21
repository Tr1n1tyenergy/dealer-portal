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
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { STAFF_ROLES } from "@/lib/access";

const createUserSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().max(254).email(),
  department: z.string().min(1).max(100),
  role: z.enum(STAFF_ROLES).default("STANDARD_USER"),
  permissions: z.array(z.string().max(254)).max(50).default([]),
});

export async function GET() {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      department: true,
      role: true,
      status: true,
      permissions: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const body = await readJson(req);

  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  // Checked after validation so input errors aren't hidden behind "email not configured".
  if (!emailDeliveryConfigured()) {
    return jsonError(
      "Email delivery is not configured. Set RESEND_API_KEY before inviting users.",
      503
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("A user with this email already exists.", 409);

  // Two invites for the same email at once: the unique index stops the second (409, not 500).
  const user = await prisma.user
    .create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        department: parsed.data.department,
        role: parsed.data.role,
        permissions: JSON.stringify(parsed.data.permissions),
        status: "PENDING",
      },
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002") return null;
      throw error;
    });
  if (!user) return jsonError("A user with this email already exists.", 409);

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
    // Roll back invite so a failed send cannot leave a usable pending invite dangling without notice
    await prisma.invitationToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    const message =
      err instanceof EmailDeliveryError
        ? err.message
        : "Invitation email could not be sent.";
    return jsonError(message, 503);
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email },
  });

  const payload: Record<string, unknown> = {
    user,
    invitationSent: true,
  };
  if (mayExposeSensitiveAuthUrls()) {
    payload.activateUrl = activateUrl;
  }

  return NextResponse.json(payload, { status: 201 });
}
