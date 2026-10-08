import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

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
