import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermissionApi, jsonError } from "@/lib/api-auth";
import { emailDeliveryConfigured } from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { mayExposeSensitiveAuthUrls } from "@/lib/security/expose-sensitive-urls";
import { mayDeleteProtectedAdmin } from "@/lib/security/protected-admins";
import { adminTargetRefusal, dealerLoginRefusal, historyRefusal, lastSuperAdminRefusal, revokeOpenLinks } from "@/lib/users/admin-rules";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { resendInvite } from "@/lib/users/resend-invite";
import { STAFF_ROLES } from "@/lib/access";

const updateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  department: z.string().min(1).max(100).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  status: z.enum(["PENDING", "ACTIVE", "DISABLED"]).optional(),
  resetInvite: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionApi("adminUsers", "act");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  if (parsed.data.role === "SUPER_ADMIN" && auth.session.user.role !== "SUPER_ADMIN") {
    return jsonError("Only Admins can make someone an Admin.", 403);
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);
  const notAdmin = adminTargetRefusal(auth.session.user, user);
  if (notAdmin) return jsonError(notAdmin.message, notAdmin.status);
  if (parsed.data.role && user.accountType !== "INTERNAL") {
    return jsonError("Only staff accounts can be given a staff role.", 400);
  }

  // A re-sent invite puts the account back to PENDING, so it counts as a status change.
  const nextStatus = parsed.data.resetInvite ? "PENDING" : parsed.data.status;
  const refusal =
    (await lastSuperAdminRefusal(user, { role: parsed.data.role, status: nextStatus })) ??
    (await dealerLoginRefusal(user, nextStatus));
  if (refusal) return jsonError(refusal.message, refusal.status);

  if (parsed.data.status === "DISABLED") await revokeOpenLinks(id);
  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      department: parsed.data.department,
      role: parsed.data.role,
      status: parsed.data.status,
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

    const sent = await resendInvite(user);
    if (!sent.ok) return jsonError(sent.message, sent.status);
    invitationSent = true;
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
  const auth = await requirePermissionApi("adminUsers", "act");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (id === auth.session.user.id) {
    return jsonError("You cannot delete your own account.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);
  const notAdmin = adminTargetRefusal(auth.session.user, user);
  if (notAdmin) return jsonError(notAdmin.message, notAdmin.status);

  if (!mayDeleteProtectedAdmin(auth.session.user.email ?? "", user.email)) {
    return jsonError(
      "This Admin account can only be deleted by admin@trinityenergyltd.com.",
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
