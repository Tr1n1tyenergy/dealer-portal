import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-auth";
import { generateSecureToken, daysFromNow } from "@/lib/tokens";
import { invitationEmailHtml, sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";

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

  let activateUrl: string | undefined;

  if (parsed.data.resetInvite) {
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
    activateUrl = `${baseUrl}/intelligence/activate?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Welcome to Trinity Retail Intelligence",
      html: invitationEmailHtml({ firstName: user.firstName, activateUrl }),
    });
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
  });

  return NextResponse.json({ user: updated, activateUrl });
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

  await prisma.user.delete({ where: { id } });
  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_DELETED",
    entity: "User",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
