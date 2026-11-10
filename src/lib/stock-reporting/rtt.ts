import type { ProductCode, StationPump, StationTank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nairobiBusinessDate } from "./dates";
import { ensureStationPumps } from "./pumps";
import { ensureStationTanks } from "./tanks";
import { calculatePumpSales, litresToCents, centsToLitres, parseLitresInput } from "./pump-calc";
import { StockReportingError } from "./service";
import { RTT_REASON_MAX_CHARS } from "./rtt-constants";
import type { ValidatedRttJobCard } from "./rtt-storage";

export { RTT_JOB_CARD_MAX_BYTES, RTT_REASON_MAX_CHARS } from "./rtt-constants";

export type RttPumpOption = {
  id: string;
  pumpKey: string;
  label: string;
  product: "PMS" | "AGO";
  /** Authoritative linked tank for this pump (null if misconfigured). */
  linkedTankId: string | null;
  linkedTankLabel: string | null;
  linkedTankKey: string | null;
};

export type RttTankOption = {
  id: string;
  tankKey: string;
  label: string;
  product: "PMS" | "AGO";
};

export type RttEventDto = {
  id: string;
  pumpKey: string;
  pumpLabel: string;
  product: "PMS" | "AGO";
  tankKey: string | null;
  tankLabel: string | null;
  volumeLitres: number;
  eventAt: string;
  notes: string | null;
  recordedById: string;
  recordedByName: string | null;
  status: "ACTIVE" | "VOIDED";
  jobCardFileName: string | null;
  jobCardSizeBytes: number | null;
  hasJobCard: boolean;
};

export type RttPumpSummary = {
  pumpKey: string;
  label: string;
  product: "PMS" | "AGO";
  tankLabel: string | null;
  eventCount: number;
  totalRttLitres: number;
};

function asFuel(product: ProductCode): "PMS" | "AGO" {
  return product === "AGO" ? "AGO" : "PMS";
}

export async function listRttStationContext(params: {
  dealerOrganizationId: string;
  stationId: string;
}) {
  const station = await prisma.station.findFirst({
    where: { id: params.stationId, dealerOrganizationId: params.dealerOrganizationId },
    select: { id: true, name: true, code: true },
  });
  if (!station) throw new StockReportingError("Station not found.", "NO_STATION");

  const [pumps, tanks] = await Promise.all([
    ensureStationPumps(station.id),
    ensureStationTanks(station.id),
  ]);

  return {
    station,
    pumps: pumps.map((p): RttPumpOption => {
      const tank = linkedTankForPump(p, tanks);
      return {
        id: p.id,
        pumpKey: p.pumpKey,
        label: p.label,
        product: asFuel(p.product),
        linkedTankId: tank?.id ?? null,
        linkedTankLabel: tank?.label ?? null,
        linkedTankKey: tank?.tankKey ?? null,
      };
    }),
    tanks: tanks.map(
      (t): RttTankOption => ({
        id: t.id,
        tankKey: t.tankKey,
        label: t.label,
        product: asFuel(t.product),
      })
    ),
  };
}

/**
 * Authoritative pump → tank link for the station.
 * Prefer matching tankKey to pumpKey (e.g. PMS-1 → PMS-1 / "PMS Tank 1").
 */
export function linkedTankForPump(
  pump: Pick<StationPump, "pumpKey" | "product">,
  tanks: Pick<StationTank, "id" | "tankKey" | "label" | "product" | "sortOrder">[]
) {
  const sameProduct = tanks
    .filter((t) => t.product === pump.product)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const exact = sameProduct.find((t) => t.tankKey === pump.pumpKey);
  if (exact) return exact;
  const suffix = pump.pumpKey.match(/-(\d+)$/)?.[1];
  if (suffix) {
    const bySuffix = sameProduct.find((t) => t.tankKey.endsWith(`-${suffix}`));
    if (bySuffix) return bySuffix;
  }
  return null;
}

/** @deprecated Prefer linkedTankForPump — kept for callers that need a soft fallback. */
export function defaultTankForPump(
  pump: Pick<StationPump, "pumpKey" | "product">,
  tanks: Pick<StationTank, "id" | "tankKey" | "label" | "product" | "sortOrder">[]
) {
  return linkedTankForPump(pump, tanks) ??
    tanks
      .filter((t) => t.product === pump.product)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ??
    null;
}

export async function sumActiveRttByPumpKey(params: {
  stationId: string;
  reportingDate: Date;
}): Promise<Map<string, number>> {
  // Aggregate in-process (avoids depending on Prisma groupBy + survives client refresh better).
  const rows = await prisma.stationPumpRttEvent.findMany({
    where: {
      stationId: params.stationId,
      reportingDate: params.reportingDate,
      status: "ACTIVE",
    },
    select: { pumpKey: true, volumeLitres: true },
  });
  const centsByPump = new Map<string, number>();
  for (const row of rows) {
    centsByPump.set(
      row.pumpKey,
      (centsByPump.get(row.pumpKey) ?? 0) + litresToCents(row.volumeLitres)
    );
  }
  const map = new Map<string, number>();
  for (const [pumpKey, cents] of centsByPump) {
    map.set(pumpKey, centsToLitres(cents));
  }
  return map;
}

export async function listRttEventsForDate(params: {
  stationId: string;
  reportingDate: Date;
  pumpKey?: string | null;
}): Promise<RttEventDto[]> {
  const events = await prisma.stationPumpRttEvent.findMany({
    where: {
      stationId: params.stationId,
      reportingDate: params.reportingDate,
      status: "ACTIVE",
      ...(params.pumpKey ? { pumpKey: params.pumpKey } : {}),
    },
    orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
  });

  const actorIds = [...new Set(events.map((e) => e.recordedById))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const actorMap = new Map(
    actors.map((a) => {
      const full = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
      return [a.id, full || a.email || null] as const;
    })
  );

  const pumps = await prisma.stationPump.findMany({
    where: { stationId: params.stationId },
    select: { pumpKey: true, label: true },
  });
  const pumpLabel = new Map(pumps.map((p) => [p.pumpKey, p.label]));

  return events.map((e) => ({
    id: e.id,
    pumpKey: e.pumpKey,
    pumpLabel: pumpLabel.get(e.pumpKey) ?? e.pumpKey,
    product: asFuel(e.product),
    tankKey: e.tankKey,
    tankLabel: e.tankLabel,
    volumeLitres: e.volumeLitres,
    eventAt: e.eventAt.toISOString(),
    notes: e.notes,
    recordedById: e.recordedById,
    recordedByName: actorMap.get(e.recordedById) ?? null,
    status: e.status,
    jobCardFileName: e.jobCardFileName,
    jobCardSizeBytes: e.jobCardSizeBytes,
    hasJobCard: Boolean(e.jobCardStorageKey),
  }));
}

export async function buildRttPumpSummaries(params: {
  stationId: string;
  reportingDate: Date;
}): Promise<{
  rows: RttPumpSummary[];
  eventCount: number;
  totalPms: number;
  totalAgo: number;
  total: number;
}> {
  const [pumps, tanks, events] = await Promise.all([
    ensureStationPumps(params.stationId),
    ensureStationTanks(params.stationId),
    prisma.stationPumpRttEvent.findMany({
      where: {
        stationId: params.stationId,
        reportingDate: params.reportingDate,
        status: "ACTIVE",
      },
      select: { pumpKey: true, volumeLitres: true, tankLabel: true },
    }),
  ]);

  const byPump = new Map<string, { count: number; totalC: number; tankLabel: string | null }>();
  for (const e of events) {
    const cur = byPump.get(e.pumpKey) ?? { count: 0, totalC: 0, tankLabel: e.tankLabel };
    cur.count += 1;
    cur.totalC += litresToCents(e.volumeLitres);
    if (!cur.tankLabel && e.tankLabel) cur.tankLabel = e.tankLabel;
    byPump.set(e.pumpKey, cur);
  }

  let totalPmsC = 0;
  let totalAgoC = 0;
  const rows: RttPumpSummary[] = pumps.map((p) => {
    const agg = byPump.get(p.pumpKey);
    const total = centsToLitres(agg?.totalC ?? 0);
    const product = asFuel(p.product);
    if (product === "PMS") totalPmsC += agg?.totalC ?? 0;
    else totalAgoC += agg?.totalC ?? 0;
    const tank = linkedTankForPump(p, tanks);
    return {
      pumpKey: p.pumpKey,
      label: p.label,
      product,
      tankLabel: agg?.tankLabel ?? tank?.label ?? null,
      eventCount: agg?.count ?? 0,
      totalRttLitres: total,
    };
  });

  return {
    rows,
    eventCount: events.length,
    totalPms: centsToLitres(totalPmsC),
    totalAgo: centsToLitres(totalAgoC),
    total: centsToLitres(totalPmsC + totalAgoC),
  };
}

export async function createRttEvent(params: {
  dealerOrganizationId: string;
  stationId: string;
  userId: string;
  pumpId: string;
  volumeRaw: string;
  /** Required explanation (max 250 chars). */
  reason: string;
  submissionKey: string;
  /** Pre-validated PDF; stored after the event row exists. */
  jobCardUpload?: ValidatedRttJobCard | null;
}) {
  const station = await prisma.station.findFirst({
    where: { id: params.stationId, dealerOrganizationId: params.dealerOrganizationId },
    select: { id: true },
  });
  if (!station) throw new StockReportingError("Station not found.", "NO_STATION");

  const volume = parseLitresInput(params.volumeRaw);
  if (volume == null || volume <= 0) {
    throw new StockReportingError("Enter a positive RTT volume in litres.", "VALIDATION", {
      volume: "Required — must be greater than zero.",
    });
  }

  const reason = params.reason.trim();
  if (!reason) {
    throw new StockReportingError("Explain why this RTT was performed.", "VALIDATION", {
      reason: "Reason / explanation is required.",
    });
  }
  if (reason.length > RTT_REASON_MAX_CHARS) {
    throw new StockReportingError(
      `Reason must be ${RTT_REASON_MAX_CHARS} characters or fewer.`,
      "VALIDATION",
      { reason: `Maximum ${RTT_REASON_MAX_CHARS} characters.` }
    );
  }

  const pump = await prisma.stationPump.findFirst({
    where: { id: params.pumpId, stationId: station.id, active: true },
  });
  if (!pump) {
    throw new StockReportingError("Selected pump does not belong to this station.", "VALIDATION", {
      pumpId: "Invalid pump.",
    });
  }

  const tanks = await ensureStationTanks(station.id);
  const tank = linkedTankForPump(pump, tanks);
  if (!tank) {
    throw new StockReportingError(
      "This pump has no linked tank configured. Contact Trinity Support before recording RTT.",
      "VALIDATION",
      { pumpId: "No linked tank for this pump." }
    );
  }

  /** Authoritative server clock — never trust client-provided event time. */
  const eventAt = new Date();
  const reportingDate = nairobiBusinessDate(eventAt);

  const closed = await prisma.stockSaleReport.findFirst({
    where: {
      stationId: station.id,
      reportingDate,
      status: "CLOSED",
    },
    select: { id: true },
  });
  if (closed) {
    throw new StockReportingError(
      "Today’s stock report is already closed. New RTT entries require an authorized adjustment process.",
      "CLOSED"
    );
  }

  const key = params.submissionKey.trim().slice(0, 64) || null;

  if (key) {
    const existing = await prisma.stationPumpRttEvent.findUnique({
      where: { stationId_submissionKey: { stationId: station.id, submissionKey: key } },
    });
    if (existing) return existing;
  }

  let created = await prisma.stationPumpRttEvent.create({
    data: {
      stationId: station.id,
      pumpId: pump.id,
      pumpKey: pump.pumpKey,
      product: pump.product,
      tankId: tank.id,
      tankKey: tank.tankKey,
      tankLabel: tank.label,
      volumeLitres: volume,
      eventAt,
      reportingDate,
      notes: reason,
      recordedById: params.userId,
      submissionKey: key,
      status: "ACTIVE",
    },
  });

  if (params.jobCardUpload) {
    const { storeRttJobCard } = await import("./rtt-storage");
    try {
      const { storageKey } = await storeRttJobCard(
        station.id,
        created.id,
        params.jobCardUpload
      );
      created = await prisma.stationPumpRttEvent.update({
        where: { id: created.id },
        data: {
          jobCardStorageKey: storageKey,
          jobCardFileName: params.jobCardUpload.fileName,
          jobCardMimeType: params.jobCardUpload.mimeType,
          jobCardSizeBytes: params.jobCardUpload.sizeBytes,
        },
      });
    } catch (err) {
      throw err instanceof Error
        ? new StockReportingError(err.message, "VALIDATION", {
            jobCard: err.message,
          })
        : err;
    }
  }

  await syncRttIntoOpenDraftReport({
    stationId: station.id,
    reportingDate,
  });

  return created;
}

/** Push aggregated RTT into an open DRAFT report for the same business day (if any). */
export async function syncRttIntoOpenDraftReport(params: {
  stationId: string;
  reportingDate: Date;
}) {
  const report = await prisma.stockSaleReport.findFirst({
    where: {
      stationId: params.stationId,
      reportingDate: params.reportingDate,
      status: "DRAFT",
    },
    include: { pumpReadings: true },
  });
  if (!report) return;

  const rttByPump = await sumActiveRttByPumpKey({
    stationId: params.stationId,
    reportingDate: params.reportingDate,
  });

  let meterPmsC = 0;
  let meterAgoC = 0;

  for (const row of report.pumpReadings) {
    const rtt = rttByPump.get(row.pumpKey) ?? 0;
    let salesLitres = row.salesLitres;
    if (row.closingLitres != null) {
      const calc = calculatePumpSales({
        opening: row.openingLitres,
        closing: row.closingLitres,
        rtt,
      });
      salesLitres = calc.ok ? calc.sales : null;
    }
    await prisma.stockSalePumpReading.update({
      where: { id: row.id },
      data: { rttLitres: rtt, salesLitres },
    });
    if (salesLitres != null) {
      const c = litresToCents(salesLitres);
      if (row.product === "AGO") meterAgoC += c;
      else meterPmsC += c;
    }
  }

  await prisma.stockSaleReport.update({
    where: { id: report.id },
    data: {
      meterSalesPmsLitres: centsToLitres(meterPmsC),
      meterSalesAgoLitres: centsToLitres(meterAgoC),
      totalSalesLitres: centsToLitres(meterPmsC + meterAgoC),
      wetStockCompletedAt: null,
      wetResolution: "NONE",
      wetState: "NOT_STARTED",
      monetaryCompletedAt: null,
      monetaryState: "NOT_STARTED",
    },
  });
}

export async function correctRttEvent(params: {
  dealerOrganizationId: string;
  eventId: string;
  userId: string;
  volumeRaw: string;
  reason: string;
}) {
  const event = await prisma.stationPumpRttEvent.findUnique({ where: { id: params.eventId } });
  if (!event) throw new StockReportingError("RTT entry not found.", "NOT_FOUND");

  const station = await prisma.station.findFirst({
    where: { id: event.stationId, dealerOrganizationId: params.dealerOrganizationId },
    select: { id: true },
  });
  if (!station) throw new StockReportingError("RTT entry not found.", "FORBIDDEN");

  const volume = parseLitresInput(params.volumeRaw);
  if (volume == null || volume <= 0) {
    throw new StockReportingError("Enter a positive RTT volume in litres.", "VALIDATION", {
      volume: "Required — must be greater than zero.",
    });
  }
  const reason = params.reason.trim();
  if (reason.length < 8) {
    throw new StockReportingError("Provide a correction reason (at least 8 characters).", "VALIDATION", {
      reason: "Reason is required.",
    });
  }

  const closed = await prisma.stockSaleReport.findFirst({
    where: {
      stationId: event.stationId,
      reportingDate: event.reportingDate,
      status: "CLOSED",
    },
    select: { id: true },
  });
  if (closed) {
    throw new StockReportingError(
      "This reporting day is already closed. RTT corrections require an authorized adjustment process.",
      "CLOSED"
    );
  }

  const updated = await prisma.stationPumpRttEvent.update({
    where: { id: event.id },
    data: {
      originalVolumeLitres: event.originalVolumeLitres ?? event.volumeLitres,
      volumeLitres: volume,
      correctionReason: reason,
      correctedAt: new Date(),
      correctedById: params.userId,
    },
  });

  await syncRttIntoOpenDraftReport({
    stationId: event.stationId,
    reportingDate: event.reportingDate,
  });

  return updated;
}
