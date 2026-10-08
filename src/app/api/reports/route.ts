import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionApi, jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["FUEL_RETAIL", "NON_FUEL_RETAIL", "GENERAL"]).default("GENERAL"),
  description: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const isAdmin = auth.session.user.role === "SUPER_ADMIN";

  const reports = await prisma.report.findMany({
    where: {
      ...(isAdmin ? {} : { userId: auth.session.user.id }),
      ...(category && category !== "ALL"
        ? { category: category as "FUEL_RETAIL" | "NON_FUEL_RETAIL" | "GENERAL" }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reports });
}

export async function POST(req: Request) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const report = await prisma.report.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
      dateFrom: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : null,
      dateTo: parsed.data.dateTo ? new Date(parsed.data.dateTo) : null,
      userId: auth.session.user.id,
      contentJson: JSON.stringify({
        modules: ["Fuel Retail Reports", "Non Fuel Retail Reports"],
        status: "framework",
        summary: "Report framework ready for future data connectors.",
      }),
    },
  });

  await logActivity({
    actorId: auth.session.user.id,
    action: "REPORT_CREATED",
    entity: "Report",
    entityId: report.id,
  });

  return NextResponse.json({ report }, { status: 201 });
}
