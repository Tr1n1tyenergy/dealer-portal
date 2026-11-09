import { NextResponse } from "next/server";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readRttJobCard } from "@/lib/stock-reporting/rtt-storage";

type Ctx = { params: Promise<{ eventId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const { eventId } = await ctx.params;

    const event = await prisma.stationPumpRttEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        stationId: true,
        jobCardStorageKey: true,
        jobCardFileName: true,
        jobCardMimeType: true,
        station: { select: { dealerOrganizationId: true } },
      },
    });

    if (!event || event.station.dealerOrganizationId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!event.jobCardStorageKey) {
      return NextResponse.json({ error: "No job card attached" }, { status: 404 });
    }

    const buf = await readRttJobCard(event.jobCardStorageKey);
    const filename = (event.jobCardFileName || "job-card.pdf").replace(/"/g, "");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": event.jobCardMimeType || "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[stock-reporting] rtt job-card", err);
    return NextResponse.json({ error: "Could not download job card" }, { status: 500 });
  }
}
