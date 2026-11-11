import {
  centsToKes,
  expectedAmountKes,
  formatKesWithCurrency,
  kesToCents,
  MONETARY_BALANCE_EPS_CENTS,
} from "./monetary-calc";
import { achievementPct } from "./staff-stock-intelligence";

export type MonetaryReportSlice = {
  reportingDate: Date;
  status: "DRAFT" | "CLOSED";
  meterSalesPmsLitres: number | null;
  meterSalesAgoLitres: number | null;
  sellingPricePmsKes: number | null;
  sellingPriceAgoKes: number | null;
  expectedPmsKes: number | null;
  expectedAgoKes: number | null;
  expectedRevenueKes: number | null;
  cashCollectionsKes: number | null;
  mpesaCollectionsKes: number | null;
  cardCollectionsKes: number | null;
  collectionsKes: number | null;
  monetaryDifferenceKes: number | null;
  monetaryDiscrepancyReason: string | null;
};

export type ProductRevenueRow = {
  product: "PMS" | "AGO";
  volumeLitres: number;
  /** null when multiple prices → use weightedAveragePrice instead */
  unitPrice: number | null;
  weightedAveragePrice: number | null;
  multiPrice: boolean;
  revenueKes: number;
};

export type StaffMonetarySummary = {
  pms: ProductRevenueRow;
  ago: ProductRevenueRow;
  totalVolume: number;
  totalRevenueKes: number;
  cashKes: number;
  mpesaKes: number;
  cardKes: number;
  totalCollectionsKes: number;
  /** Collections − Expected revenue */
  monetaryVarianceKes: number;
  reportsIncluded: number;
  incompleteDays: number;
};

function dec(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return n;
}

function reportPmsRevenue(r: MonetaryReportSlice): number {
  if (r.expectedPmsKes != null && Number.isFinite(r.expectedPmsKes)) return r.expectedPmsKes;
  const vol = dec(r.meterSalesPmsLitres);
  const price = r.sellingPricePmsKes;
  if (price != null && Number.isFinite(price)) return expectedAmountKes(vol, price);
  return 0;
}

function reportAgoRevenue(r: MonetaryReportSlice): number {
  if (r.expectedAgoKes != null && Number.isFinite(r.expectedAgoKes)) return r.expectedAgoKes;
  const vol = dec(r.meterSalesAgoLitres);
  const price = r.sellingPriceAgoKes;
  if (price != null && Number.isFinite(price)) return expectedAmountKes(vol, price);
  return 0;
}

function uniquePrices(prices: number[]): boolean {
  const rounded = [...new Set(prices.map((p) => kesToCents(p)))];
  return rounded.length > 1;
}

function buildProductRow(
  product: "PMS" | "AGO",
  closed: MonetaryReportSlice[]
): ProductRevenueRow {
  let volC = 0;
  let revC = 0;
  const prices: number[] = [];
  for (const r of closed) {
    const vol = product === "PMS" ? dec(r.meterSalesPmsLitres) : dec(r.meterSalesAgoLitres);
    const rev = product === "PMS" ? reportPmsRevenue(r) : reportAgoRevenue(r);
    volC += Math.round(vol * 100);
    revC += kesToCents(rev);
    const price = product === "PMS" ? r.sellingPricePmsKes : r.sellingPriceAgoKes;
    if (price != null && Number.isFinite(price) && vol > 0) prices.push(price);
  }
  const volumeLitres = volC / 100;
  const revenueKes = centsToKes(revC);
  const multiPrice = uniquePrices(prices);
  const weightedAveragePrice = volumeLitres > 0.0005 ? revC / volC : null;
  const unitPrice = multiPrice ? null : prices[0] ?? weightedAveragePrice;

  return {
    product,
    volumeLitres,
    unitPrice,
    weightedAveragePrice,
    multiPrice,
    revenueKes,
  };
}

export function aggregateStaffMonetary(reports: MonetaryReportSlice[]): StaffMonetarySummary {
  const closed = reports.filter((r) => r.status === "CLOSED");
  const pms = buildProductRow("PMS", closed);
  const ago = buildProductRow("AGO", closed);

  let cashC = 0;
  let mpesaC = 0;
  let cardC = 0;
  for (const r of closed) {
    cashC += kesToCents(dec(r.cashCollectionsKes));
    mpesaC += kesToCents(dec(r.mpesaCollectionsKes));
    cardC += kesToCents(dec(r.cardCollectionsKes));
  }

  const totalRevenueKes = centsToKes(kesToCents(pms.revenueKes) + kesToCents(ago.revenueKes));
  const totalCollectionsKes = centsToKes(cashC + mpesaC + cardC);
  const monetaryVarianceKes = centsToKes(
    kesToCents(totalCollectionsKes) - kesToCents(totalRevenueKes)
  );

  return {
    pms,
    ago,
    totalVolume: pms.volumeLitres + ago.volumeLitres,
    totalRevenueKes,
    cashKes: centsToKes(cashC),
    mpesaKes: centsToKes(mpesaC),
    cardKes: centsToKes(cardC),
    totalCollectionsKes,
    monetaryVarianceKes,
    reportsIncluded: closed.length,
    incompleteDays: reports.filter((r) => r.status === "DRAFT").length,
  };
}

export function monetaryTargetKes(params: {
  volumeTarget: number | null;
  priceKesPerLitre: number | null;
}): number | null {
  if (params.volumeTarget == null || params.priceKesPerLitre == null) return null;
  if (!Number.isFinite(params.volumeTarget) || !Number.isFinite(params.priceKesPerLitre)) return null;
  return expectedAmountKes(params.volumeTarget, params.priceKesPerLitre);
}

export type TargetVsActualRow = {
  product: "PMS" | "AGO" | "Total";
  targetKes: number | null;
  actualKes: number;
  varianceKes: number | null;
  achievementPct: number | null;
};

export function buildTargetVsActual(params: {
  pmsActual: number;
  agoActual: number;
  pmsTarget: number | null;
  agoTarget: number | null;
}): TargetVsActualRow[] {
  const totalActual = centsToKes(kesToCents(params.pmsActual) + kesToCents(params.agoActual));
  const totalTarget =
    params.pmsTarget != null || params.agoTarget != null
      ? centsToKes(kesToCents(params.pmsTarget ?? 0) + kesToCents(params.agoTarget ?? 0))
      : null;

  function row(
    product: TargetVsActualRow["product"],
    actual: number,
    target: number | null
  ): TargetVsActualRow {
    const variance =
      target == null ? null : centsToKes(kesToCents(actual) - kesToCents(target));
    return {
      product,
      targetKes: target,
      actualKes: actual,
      varianceKes: variance,
      achievementPct: achievementPct(actual, target),
    };
  }

  return [
    row("PMS", params.pmsActual, params.pmsTarget),
    row("AGO", params.agoActual, params.agoTarget),
    row("Total", totalActual, totalTarget),
  ];
}

export type PaymentSlice = {
  key: "cash" | "mpesa" | "card";
  label: string;
  amountKes: number;
  pct: number;
  color: string;
};

export function paymentMethodSlices(summary: StaffMonetarySummary): PaymentSlice[] {
  const total = summary.totalCollectionsKes;
  const items: Omit<PaymentSlice, "pct">[] = [
    { key: "cash", label: "Cash", amountKes: summary.cashKes, color: "#3551a5" },
    { key: "mpesa", label: "M-Pesa", amountKes: summary.mpesaKes, color: "#ffcc00" },
    { key: "card", label: "Card (Visa)", amountKes: summary.cardKes, color: "#8fb0ef" },
  ];
  return items.map((i) => ({
    ...i,
    pct:
      total > centsToKes(MONETARY_BALANCE_EPS_CENTS)
        ? (i.amountKes / total) * 100
        : 0,
  }));
}

export type TrendPoint = {
  key: string;
  label: string;
  actualKes: number | null;
  targetKes: number | null;
  missing: boolean;
};

/** Group CLOSED reports by UTC Y-M-D for a daily trend. */
export function buildDailyRevenueTrend(params: {
  closed: MonetaryReportSlice[];
  days: Date[];
  dailyTargetKes: number | null;
}): TrendPoint[] {
  const byDay = new Map<string, MonetaryReportSlice[]>();
  for (const r of params.closed) {
    const k = r.reportingDate.toISOString().slice(0, 10);
    const list = byDay.get(k) ?? [];
    list.push(r);
    byDay.set(k, list);
  }

  return params.days.map((d) => {
    const key = d.toISOString().slice(0, 10);
    const rows = byDay.get(key) ?? [];
    if (rows.length === 0) {
      return {
        key,
        label: formatTrendDay(d),
        actualKes: null,
        targetKes: params.dailyTargetKes,
        missing: true,
      };
    }
    const agg = aggregateStaffMonetary(rows);
    return {
      key,
      label: formatTrendDay(d),
      actualKes: agg.totalRevenueKes,
      targetKes: params.dailyTargetKes,
      missing: false,
    };
  });
}

function formatTrendDay(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]}`;
}

export function formatKshCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-KE", {
    maximumFractionDigits: abs >= 1000 ? 0 : 2,
    minimumFractionDigits: 0,
  });
  if (value < -centsToKes(MONETARY_BALANCE_EPS_CENTS)) return `−KSh ${formatted}`;
  if (value < 0) return `KSh ${formatted}`;
  return `KSh ${formatted}`;
}

export function formatKshSignedCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value).toLocaleString("en-KE", { maximumFractionDigits: 0 });
  if (Math.abs(kesToCents(value)) <= MONETARY_BALANCE_EPS_CENTS) return `KSh 0`;
  if (value < 0) return `−KSh ${abs}`;
  return `+KSh ${abs}`;
}

export { formatKesWithCurrency, achievementPct };
