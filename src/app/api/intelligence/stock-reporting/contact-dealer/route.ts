import { NextResponse } from "next/server";
import { canUser } from "@/lib/permissions";
import { requireInternalApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDirectConversation } from "@/lib/messaging/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resolve a dealer user for the station's organisation and open/create a DIRECT conversation. */
export async function POST(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  if (!canUser(auth.session.user, "messaging", "view")) {
    return NextResponse.json({ error: "Messaging permission required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { stationId?: string } | null;
  const stationId = body?.stationId?.trim();
  if (!stationId) return NextResponse.json({ error: "stationId is required" }, { status: 400 });

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: {
      id: true,
      name: true,
      tradingName: true,
      dealerOrganizationId: true,
      dealerOrganization: { select: { name: true } },
    },
  });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const peer = await prisma.user.findFirst({
    where: {
      accountType: "DEALER",
      dealerOrganizationId: station.dealerOrganizationId,
      status: "ACTIVE",
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!peer) {
    return NextResponse.json(
      { error: "No active dealer user found for this station’s organisation." },
      { status: 404 }
    );
  }

  const conversation = await getOrCreateDirectConversation(auth.session.user.id, peer.id);
  const stationName = station.tradingName || station.name;

  return NextResponse.json({
    conversationId: conversation.id,
    href: `/intelligence/retail/messaging?c=${encodeURIComponent(conversation.id)}`,
    contextHint: `Stock Intelligence — ${stationName}`,
    dealerName: station.dealerOrganization.name,
  });
}
