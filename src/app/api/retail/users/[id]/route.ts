import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { mayDeleteProtectedAdmin } from "@/lib/security/protected-admins";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  role: z
    .enum(["SUPER_ADMIN", "STANDARD_USER", "DEALER_ADMIN", "DEALER_USER"])
    .optional(),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);
  if (user.accountType !== "INTERNAL" && user.accountType !== "DEALER") {
    return jsonError("Only retail (internal/dealer) users can be edited here.", 400);
  }

  if (parsed.data.role) {
    const role = parsed.data.role;
    if (user.accountType === "INTERNAL" && role !== "SUPER_ADMIN" && role !== "STANDARD_USER") {
      return jsonError("Internal users may only be Super Admin or Standard User.", 400);
    }
    if (user.accountType === "DEALER" && role !== "DEALER_ADMIN" && role !== "DEALER_USER") {
      return jsonError("Dealer users may only be Dealer Admin or Dealer User.", 400);
    }
  }

  // Do not demote/disable the last active SUPER_ADMIN
  if (
    user.role === "SUPER_ADMIN" &&
    user.status === "ACTIVE" &&
    ((parsed.data.role && parsed.data.role !== "SUPER_ADMIN") ||
      (parsed.data.status && parsed.data.status !== "ACTIVE"))
  ) {
    const otherAdmins = await prisma.user.count({
      where: {
        id: { not: id },
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        accountType: "INTERNAL",
      },
    });
    if (otherAdmins === 0) {
      return jsonError("Cannot demote or disable the last active Super Admin.", 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      department: parsed.data.department,
      role: parsed.data.role,
      status: parsed.data.status,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      accountType: true,
      status: true,
      department: true,
      createdAt: true,
      lastLoginAt: true,
      dealerOrganization: {
        select: {
          name: true,
          code: true,
          stations: { select: { name: true, tradingName: true, code: true }, take: 3 },
        },
      },
    },
  });

  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  if (id === auth.session.user.id) {
    return jsonError("You cannot delete your own account.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);
  if (user.accountType !== "INTERNAL" && user.accountType !== "DEALER") {
    return jsonError("Only retail (internal/dealer) users can be deleted here.", 400);
  }

  if (!mayDeleteProtectedAdmin(auth.session.user.email ?? "", user.email)) {
    return jsonError(
      "This Super Admin account can only be deleted by admin@trinityenergyltd.com.",
      403
    );
  }

  if (user.role === "SUPER_ADMIN" && user.status === "ACTIVE") {
    const otherAdmins = await prisma.user.count({
      where: {
        id: { not: id },
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        accountType: "INTERNAL",
      },
    });
    if (otherAdmins === 0) {
      return jsonError("Cannot delete the last active Super Admin.", 400);
    }
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
