import { NextResponse } from "next/server";
import { jsonError, requireDealerApi } from "@/lib/api-auth";
import { getTicketForDealer } from "@/lib/support/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  try {
    const ticket = await getTicketForDealer(id, auth.session.user.dealerOrganizationId!);
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Not found", 404);
  }
}
