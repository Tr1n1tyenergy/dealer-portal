import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-auth";
import { generateSecureToken, daysFromNow } from "@/lib/tokens";
import { invitationEmailHtml, sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";

const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  department: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "STANDARD_USER"]).default("STANDARD_USER"),
  permissions: z.array(z.string()).default([]),
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

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

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
      permissions: JSON.stringify(parsed.data.permissions),
      status: "PENDING",
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

  await sendEmail({
    to: user.email,
    subject: "Welcome to Trinity Retail Intelligence",
    html: invitationEmailHtml({ firstName: user.firstName, activateUrl }),
  });

  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email },
  });

  return NextResponse.json({ user, activateUrl }, { status: 201 });
}
