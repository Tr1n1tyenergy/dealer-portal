import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api-auth";
import { listStationInviteCatalog } from "@/lib/dealers/station-invite-catalog";
import { findCompanyLogins } from "@/lib/dealers/dealer-invite";

export async function GET() {
  const auth = await requirePermissionApi("retail.users");
  if ("error" in auth) return auth.error;

  const catalog = listStationInviteCatalog();
  const logins = await findCompanyLogins(Array.from(new Set(catalog.map((s) => s.orgCode))));
  const stations = catalog.map((s) => ({
    stationCode: s.stationCode,
    stationName: s.stationName,
    tradingName: s.tradingName,
    orgCode: s.orgCode,
    orgName: s.orgName,
    invitable: s.invitable,
    hasLogin: logins.has(s.orgCode),
    loginEmail: logins.get(s.orgCode) ?? null,
  }));

  return NextResponse.json({ stations });
}
