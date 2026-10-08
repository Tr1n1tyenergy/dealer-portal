import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionApi, jsonError } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const isAdmin = auth.session.user.role === "SUPER_ADMIN";

  const report = await prisma.report.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: auth.session.user.id }),
    },
  });

  if (!report) return jsonError("Report not found", 404);
  return NextResponse.json({ report });
}
