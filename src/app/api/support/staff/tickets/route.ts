import { NextResponse } from "next/server";
import { SupportTicketDepartment, SupportTicketStatus } from "@prisma/client";
import { requirePermissionApi } from "@/lib/api-auth";
import { listTicketsForStaff } from "@/lib/support/service";

/** Staff foundation — department queues for the future Support Management UI. */
export async function GET(req: Request) {
  const auth = await requirePermissionApi("support", "view");
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const tickets = await listTicketsForStaff({
    department: (url.searchParams.get("department") || "ALL") as SupportTicketDepartment | "ALL",
    status: (url.searchParams.get("status") || "ALL") as SupportTicketStatus | "ALL",
    q: url.searchParams.get("q") || "",
  });

  return NextResponse.json({ tickets });
}
