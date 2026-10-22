import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionApi } from "@/lib/api-auth";

export async function GET() {
  const auth = await requirePermissionApi("retailUsers", "view");
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    where: {
      accountType: { in: ["INTERNAL", "DEALER"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      accountType: true,
      status: true,
      department: true,
      createdAt: true,
      lastLoginAt: true,
      dealerOrganization: {
        select: {
          name: true,
          code: true,
          stations: { select: { name: true, tradingName: true, code: true }, take: 3 },
        },
      },
    },
  });

  return NextResponse.json({ users });
}
