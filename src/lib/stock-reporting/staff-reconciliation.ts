import { litresToCents, centsToLitres } from "./pump-calc";
import { formatStockReportDate, nairobiBusinessDate } from "./dates";
import { nairobiParts } from "@/lib/time/nairobi";

export type StaffReportingPeriod = "day" | "week" | "month" | "year" | "custom";

export type ProductCodeLite = "PMS" | "AGO";

export type ProductReconRow = {
  product: ProductCodeLite;
  opening: number;
  received: number;
  available: number;
  sales: number;
  expectedClosing: number;
  actualClosing: number;
  variance: number;
  /** null when expected closing is ~0 */
  variancePct: number | null;
};

export type StaffReconSummary = {
  rows: ProductReconRow[];
  total: ProductReconRow;
  totalSales: number;
  netVariance: number;
  netVariancePct: number | null;
  /** Delivery receipts are not yet persisted — always 0 until ledger exists. */
  receiptsRecorded: boolean;
};

export type PeriodBounds = {
  period: StaffReportingPeriod;
  start: Date;
  /** Exclusive end (UTC midnight of next Nairobi day after last included day). */
  endExclusive: Date;
  label: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function utcYmd(d: Date): { y: number; m: number; day: number } {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

/** Monday-start business week containing `day` (UTC Y-M-D date). */
function weekBoundsContaining(day: Date): { start: Date; endExclusive: Date } {
  const { y, m, day: d } = utcYmd(day);
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(Date.UTC(y, m, d + mondayOffset));
  return { start, endExclusive: addUtcDays(start, 7) };
}

export function parseIsoDateParam(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

export function toIsoDateParam(d: Date): string {
  const { y, m, day } = utcYmd(d);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function resolvePeriodBounds(params: {
  period: StaffReportingPeriod;
  date?: Date | null;
  from?: Date | null;
  to?: Date | null;
  now?: Date;
}): PeriodBounds {
  const now = params.now ?? new Date();
  const anchor = params.date ?? nairobiBusinessDate(now);

  if (params.period === "day") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
    return {
      period: "day",
      start,
      endExclusive: addUtcDays(start, 1),
      label: formatStockReportDate(start),
    };
  }

  if (params.period === "week") {
    const { start, endExclusive } = weekBoundsContaining(anchor);
    const last = addUtcDays(endExclusive, -1);
    return {
      period: "week",
      start,
      endExclusive,
      label: `${formatStockReportDate(start)} – ${formatStockReportDate(last)}`,
    };
  }

  if (params.period === "month") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const endExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    return {
      period: "month",
      start,
      endExclusive,
      label: `${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`,
    };
  }

  if (params.period === "year") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
    const endExclusive = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1));
    return {
      period: "year",
      start,
      endExclusive,
      label: String(anchor.getUTCFullYear()),
    };
  }

  // custom
  let start = params.from ?? anchor;
  let end = params.to ?? anchor;
  if (end.getTime() < start.getTime()) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endExclusive = addUtcDays(
    new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())),
    1
  );
  const last = addUtcDays(endExclusive, -1);
  const same = start.getTime() === last.getTime();
  return {
    period: "custom",
    start,
    endExclusive,
    label: same
      ? formatStockReportDate(start)
      : `${formatStockReportDate(start)} – ${formatStockReportDate(last)}`,
  };
}

export function countNairobiDaysInRange(start: Date, endExclusive: Date): number {
  return Math.max(0, Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000));
}

/** Expected report days: range clipped so future Nairobi calendar days are not required. */
export function expectedReportDaysInRange(
  start: Date,
  endExclusive: Date,
  now: Date = new Date()
): number {
  const today = nairobiBusinessDate(now);
  const tomorrow = addUtcDays(today, 1);
  const clippedEnd = endExclusive.getTime() < tomorrow.getTime() ? endExclusive : tomorrow;
  if (clippedEnd.getTime() <= start.getTime()) return 0;
  return countNairobiDaysInRange(start, clippedEnd);
}

export type ReportReadingSlice = {
  reportingDate: Date;
  status: "DRAFT" | "CLOSED";
  meterSalesPmsLitres: number | null;
  meterSalesAgoLitres: number | null;
  tankReadings: {
    product: string;
    openingLitres: number;
    closingLitres: number | null;
  }[];
  pumpReadings: {
    product: string;
    salesLitres: number | null;
  }[];
};

function sumTankOpening(readings: ReportReadingSlice["tankReadings"], product: ProductCodeLite): number {
  let c = 0;
  for (const r of readings) {
    if (r.product === product) c += litresToCents(r.openingLitres);
  }
  return centsToLitres(c);
}

function sumTankClosing(readings: ReportReadingSlice["tankReadings"], product: ProductCodeLite): number | null {
  let c = 0;
  let any = false;
  for (const r of readings) {
    if (r.product !== product) continue;
    if (r.closingLitres == null) return null;
    any = true;
    c += litresToCents(r.closingLitres);
  }
  return any ? centsToLitres(c) : null;
}

function sumMeterSales(report: ReportReadingSlice, product: ProductCodeLite): number {
  const snap =
    product === "PMS" ? report.meterSalesPmsLitres : report.meterSalesAgoLitres;
  if (snap != null && Number.isFinite(snap)) return snap;
  let c = 0;
  for (const p of report.pumpReadings) {
    if (p.product === product && p.salesLitres != null) c += litresToCents(p.salesLitres);
  }
  return centsToLitres(c);
}

/**
 * Build mockup-style inventory recon from CLOSED dealer reports.
 *
 * Received / Purchases: always 0 until a delivery-receipt ledger exists
 * (`listEligibleStockDeliveries` is currently empty). Expected closing =
 * Opening + Received − Sales; Variance = Actual − Expected.
 *
 * Period rules:
 * - Opening = first chronological CLOSED report tank openings
 * - Actual closing = last chronological CLOSED report tank closings
 * - Sales = sum of meter sales across CLOSED reports
 */
export function aggregateStaffReconciliation(reports: ReportReadingSlice[]): StaffReconSummary {
  const closed = [...reports]
    .filter((r) => r.status === "CLOSED")
    .sort((a, b) => a.reportingDate.getTime() - b.reportingDate.getTime());

  const emptyRow = (product: ProductCodeLite): ProductReconRow => ({
    product,
    opening: 0,
    received: 0,
    available: 0,
    sales: 0,
    expectedClosing: 0,
    actualClosing: 0,
    variance: 0,
    variancePct: null,
  });

  if (closed.length === 0) {
    const pms = emptyRow("PMS");
    const ago = emptyRow("AGO");
    return {
      rows: [pms, ago],
      total: emptyRow("PMS"),
      totalSales: 0,
      netVariance: 0,
      netVariancePct: null,
      receiptsRecorded: false,
    };
  }

  const first = closed[0]!;
  const last = closed[closed.length - 1]!;

  function buildProduct(product: ProductCodeLite): ProductReconRow {
    const opening = sumTankOpening(first.tankReadings, product);
    const actualClosing = sumTankClosing(last.tankReadings, product) ?? 0;
    let salesC = 0;
    for (const r of closed) {
      salesC += litresToCents(sumMeterSales(r, product));
    }
    const sales = centsToLitres(salesC);
    const received = 0;
    const available = centsToLitres(litresToCents(opening) + litresToCents(received));
    const expectedClosing = centsToLitres(litresToCents(available) - litresToCents(sales));
    const variance = centsToLitres(litresToCents(actualClosing) - litresToCents(expectedClosing));
    const variancePct =
      Math.abs(expectedClosing) < 0.0005
        ? null
        : (variance / expectedClosing) * 100;

    return {
      product,
      opening,
      received,
      available,
      sales,
      expectedClosing,
      actualClosing,
      variance,
      variancePct,
    };
  }

  const pms = buildProduct("PMS");
  const ago = buildProduct("AGO");

  const total: ProductReconRow = {
    product: "PMS",
    opening: centsToLitres(litresToCents(pms.opening) + litresToCents(ago.opening)),
    received: centsToLitres(litresToCents(pms.received) + litresToCents(ago.received)),
    available: centsToLitres(litresToCents(pms.available) + litresToCents(ago.available)),
    sales: centsToLitres(litresToCents(pms.sales) + litresToCents(ago.sales)),
    expectedClosing: centsToLitres(
      litresToCents(pms.expectedClosing) + litresToCents(ago.expectedClosing)
    ),
    actualClosing: centsToLitres(
      litresToCents(pms.actualClosing) + litresToCents(ago.actualClosing)
    ),
    variance: centsToLitres(litresToCents(pms.variance) + litresToCents(ago.variance)),
    variancePct: null,
  };
  total.variancePct =
    Math.abs(total.expectedClosing) < 0.0005
      ? null
      : (total.variance / total.expectedClosing) * 100;

  return {
    rows: [pms, ago],
    total,
    totalSales: total.sales,
    netVariance: total.variance,
    netVariancePct: total.variancePct,
    receiptsRecorded: false,
  };
}

export function formatSignedLitres(value: number, digits = 0): string {
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (value > 0.0005) return `+${abs}`;
  if (value < -0.0005) return `−${abs}`;
  return abs;
}

export function formatVariancePct(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (value > 0.00005) return `+${abs}%`;
  if (value < -0.00005) return `−${abs}%`;
  return `${abs}%`;
}

export function formatLitresCell(value: number, digits = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function completenessLabel(params: {
  expectedDays: number;
  closedDays: number;
  hasDraft: boolean;
}): { status: "complete" | "incomplete" | "pending" | "none"; label: string } {
  const { expectedDays, closedDays, hasDraft } = params;
  if (closedDays === 0 && !hasDraft) return { status: "none", label: "No Reports" };
  if (closedDays === 0 && hasDraft) return { status: "pending", label: "Reports Pending" };
  if (closedDays >= expectedDays && expectedDays > 0) {
    return { status: "complete", label: "Reports Complete" };
  }
  return { status: "incomplete", label: "Reports Incomplete" };
}

/** Nairobi “today” as UTC Y-M-D date for period defaults. */
export function defaultStaffReportDate(now = new Date()): Date {
  return nairobiBusinessDate(now);
}

export function nairobiCalendarParts(now = new Date()) {
  return nairobiParts(now);
}
