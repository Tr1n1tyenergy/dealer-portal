import { NextResponse } from "next/server";
import { requireDealerApi } from "@/lib/api-auth";
import { countTicketsForOrg } from "@/lib/support/service";

export async function GET() {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;

  const counts = await countTicketsForOrg(auth.session.user.dealerOrganizationId!);
  return NextResponse.json(counts);
}
