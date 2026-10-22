import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { isStaffAccount } from "@/lib/access";
import { canUser, type PermissionLevel, type PermissionModule } from "@/lib/permissions";
import { authOptions } from "@/lib/auth";
import { canUseMessaging } from "@/lib/messaging/authz";

export function jsonError(message: unknown, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireSessionApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: jsonError("Unauthorized", 401) as NextResponse };
  }
  return { session };
}

/**
 * INTERNAL staff only. Use for every staff-portal API (reports, note sessions, presentations,
 * Retail Interface); dealer and depot logins get 403. Messaging APIs use requireMessagingApi.
 */
export async function requireInternalApi() {
  const result = await requireSessionApi();
  if ("error" in result) return result;
  if (!isStaffAccount(result.session.user.accountType)) {
    return { error: jsonError("Forbidden", 403) as NextResponse };
  }
  return result;
}

/** Staff and dealers only (messaging); depot logins get 403. */
export async function requireMessagingApi() {
  const result = await requireSessionApi();
  if ("error" in result) return result;
  if (!canUseMessaging(result.session.user.accountType, result.session.user.role)) {
    return { error: jsonError("Messaging is not available for this account.", 403) as NextResponse };
  }
  return result;
}

/** Staff who may view or act on a module (role default + the person's Allow/Deny ticks). */
export async function requirePermissionApi(module: PermissionModule, level: PermissionLevel) {
  const result = await requireInternalApi();
  if ("error" in result) return result;
  if (!canUser(result.session.user, module, level)) {
    return { error: jsonError("Forbidden", 403) as NextResponse };
  }
  return result;
}
