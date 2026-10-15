import { NextResponse } from "next/server";
import { requireMessagingApi } from "@/lib/api-auth";
import { listDirectory } from "@/lib/messaging/service";

export async function GET() {
  const auth = await requireMessagingApi();
  if ("error" in auth) return auth.error;

  const users = await listDirectory(auth.session.user.id);
  return NextResponse.json({
    users: users.map((u) => {
      const trading =
        u.dealerOrganization?.stations?.[0]?.tradingName ||
        u.dealerOrganization?.stations?.[0]?.name ||
        u.dealerOrganization?.name;
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        accountType: u.accountType,
        email: u.email,
        displayName: trading || `${u.firstName} ${u.lastName}`,
      };
    }),
  });
}
