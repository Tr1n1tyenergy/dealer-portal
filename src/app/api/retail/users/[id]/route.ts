import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { mayDeleteProtectedAdmin } from "@/lib/security/protected-admins";
import { dealerLoginRefusal, historyRefusal, lastSuperAdminRefusal } from "@/lib/users/admin-rules";

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

  const refusal =
    (await lastSuperAdminRefusal(user, { role: parsed.data.role, status: parsed.data.status })) ??
    (await dealerLoginRefusal(user, parsed.data.status));
  if (refusal) return jsonError(refusal.message, refusal.status);

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

  const refusal = (await lastSuperAdminRefusal(user, { deleting: true })) ?? (await historyRefusal(id));
  if (refusal) return jsonError(refusal.message, refusal.status);

  await prisma.user.delete({ where: { id } });
  await logActivity({
    actorId: auth.session.user.id,
    action: "USER_DELETED",
    entity: "User",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
