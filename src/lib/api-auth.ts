import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { isStaffAccount } from "@/lib/access";
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

export async function requireSuperAdminApi() {
  const result = await requireSessionApi();
  if ("error" in result) return result;
  if (result.session.user.role !== "SUPER_ADMIN") {
    return { error: jsonError("Forbidden", 403) as NextResponse };
  }
  return result;
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
  if (!canUseMessaging(result.session.user.accountType)) {
    return { error: jsonError("Messaging is not available for this account.", 403) as NextResponse };
  }
  return result;
}
