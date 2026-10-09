import { NextResponse } from "next/server";
import { requireInternalApi } from "@/lib/api-auth";
import { listStationInviteCatalog } from "@/lib/dealers/station-invite-catalog";

export async function GET() {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  const stations = listStationInviteCatalog().map((s) => ({
    stationCode: s.stationCode,
    stationName: s.stationName,
    tradingName: s.tradingName,
    orgCode: s.orgCode,
    invitable: s.invitable,
  }));

  return NextResponse.json({ stations });
}
