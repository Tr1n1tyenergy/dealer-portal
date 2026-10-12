import { NextResponse } from "next/server";
import { requireSessionApi, jsonError } from "@/lib/api-auth";
import { getConversationContext } from "@/lib/messaging/service";
import { analyticsStatusBucket } from "@/lib/retail/analytics";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  try {
    const context = await getConversationContext(id, auth.session.user.id);
    return NextResponse.json({
      ...context,
      recentOrders: context.recentOrders.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        statusLabel: analyticsStatusBucket(o.status) ?? o.status.replace(/_/g, " "),
        createdAt: o.createdAt,
        station: o.station.tradingName || o.station.name,
      })),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Forbidden", 403);
  }
}
