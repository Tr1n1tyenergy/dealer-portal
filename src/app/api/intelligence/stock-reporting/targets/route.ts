import { NextResponse } from "next/server";
import { canUser } from "@/lib/permissions";
import { requireInternalApi } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import { EMPTY_INTELLIGENCE_CONFIG } from "@/lib/stock-reporting/staff-stock-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function numOrDefault(v: unknown, fallback: number): number {
  const n = numOrNull(v);
  return n == null ? fallback : n;
}

export async function GET(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  if (!canUser(auth.session.user, "analytics", "view") && !canUser(auth.session.user, "orders", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stationId = new URL(req.url).searchParams.get("station");
  if (!stationId) return NextResponse.json({ error: "station is required" }, { status: 400 });

  const asOf = nairobiBusinessDate();
  const row = await prisma.stationStockIntelligenceConfig.findFirst({
    where: { stationId, effectiveFrom: { lte: asOf } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!row) {
    return NextResponse.json({ stationId, config: EMPTY_INTELLIGENCE_CONFIG, effectiveFrom: null });
  }

  return NextResponse.json({
    stationId,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    config: {
      pmsDailyTargetLitres: row.pmsDailyTargetLitres,
      agoDailyTargetLitres: row.agoDailyTargetLitres,
      pmsWeeklyTargetLitres: row.pmsWeeklyTargetLitres,
      agoWeeklyTargetLitres: row.agoWeeklyTargetLitres,
      pmsMonthlyTargetLitres: row.pmsMonthlyTargetLitres,
      agoMonthlyTargetLitres: row.agoMonthlyTargetLitres,
      pmsYearlyTargetLitres: row.pmsYearlyTargetLitres,
      agoYearlyTargetLitres: row.agoYearlyTargetLitres,
      pmsMinHoldingLitres: row.pmsMinHoldingLitres,
      agoMinHoldingLitres: row.agoMinHoldingLitres,
      pmsTwoDayHoldingLitres: row.pmsTwoDayHoldingLitres,
      agoTwoDayHoldingLitres: row.agoTwoDayHoldingLitres,
      pmsWarningCoverDays: row.pmsWarningCoverDays,
      agoWarningCoverDays: row.agoWarningCoverDays,
      pmsCriticalCoverDays: row.pmsCriticalCoverDays,
      agoCriticalCoverDays: row.agoCriticalCoverDays,
    },
  });
}

export async function PUT(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  const canEdit =
    auth.session.user.role === "SUPER_ADMIN" ||
    canUser(auth.session.user, "settings", "view") ||
    canUser(auth.session.user, "orders", "act");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const stationId = typeof body.stationId === "string" ? body.stationId : "";
  if (!stationId) return NextResponse.json({ error: "stationId is required" }, { status: 400 });

  const station = await prisma.station.findUnique({ where: { id: stationId }, select: { id: true } });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const effectiveFrom = nairobiBusinessDate();
  const data = {
    pmsDailyTargetLitres: numOrNull(body.pmsDailyTargetLitres),
    agoDailyTargetLitres: numOrNull(body.agoDailyTargetLitres),
    pmsWeeklyTargetLitres: numOrNull(body.pmsWeeklyTargetLitres),
    agoWeeklyTargetLitres: numOrNull(body.agoWeeklyTargetLitres),
    pmsMonthlyTargetLitres: numOrNull(body.pmsMonthlyTargetLitres),
    agoMonthlyTargetLitres: numOrNull(body.agoMonthlyTargetLitres),
    pmsYearlyTargetLitres: numOrNull(body.pmsYearlyTargetLitres),
    agoYearlyTargetLitres: numOrNull(body.agoYearlyTargetLitres),
    pmsMinHoldingLitres: numOrNull(body.pmsMinHoldingLitres),
    agoMinHoldingLitres: numOrNull(body.agoMinHoldingLitres),
    pmsTwoDayHoldingLitres: numOrNull(body.pmsTwoDayHoldingLitres),
    agoTwoDayHoldingLitres: numOrNull(body.agoTwoDayHoldingLitres),
    pmsWarningCoverDays: numOrDefault(body.pmsWarningCoverDays, 3),
    agoWarningCoverDays: numOrDefault(body.agoWarningCoverDays, 3),
    pmsCriticalCoverDays: numOrDefault(body.pmsCriticalCoverDays, 1),
    agoCriticalCoverDays: numOrDefault(body.agoCriticalCoverDays, 1),
    createdById: auth.session.user.id,
  };

  const previous = await prisma.stationStockIntelligenceConfig.findFirst({
    where: { stationId, effectiveFrom: { lte: effectiveFrom } },
    orderBy: { effectiveFrom: "desc" },
  });

  const saved = await prisma.stationStockIntelligenceConfig.upsert({
    where: { stationId_effectiveFrom: { stationId, effectiveFrom } },
    create: { stationId, effectiveFrom, ...data },
    update: { ...data },
  });

  await logActivity({
    actorId: auth.session.user.id,
    action: "STAFF_STOCK_INTELLIGENCE_CONFIG_SAVE",
    entity: "Station",
    entityId: stationId,
    meta: {
      effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
      previousId: previous?.id ?? null,
      savedId: saved.id,
      config: data,
    },
  });

  return NextResponse.json({ ok: true, id: saved.id });
}
