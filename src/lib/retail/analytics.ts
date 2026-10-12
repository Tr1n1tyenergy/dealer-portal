import type { DealerOrderStatus } from "@prisma/client";
import { dealerStatusLabel } from "@/lib/orders/state-machine";

export type AnalyticsStatusBucket =
  | "Quotation Processing"
  | "Awaiting Payment"
  | "PFI Issued"
  | "Depot Processing"
  | "In Transit"
  | "Delivered";

export const STATUS_BUCKET_COLORS: Record<AnalyticsStatusBucket, string> = {
  "Quotation Processing": "#3B82F6",
  "Awaiting Payment": "#F5B800",
  "PFI Issued": "#F97316",
  "Depot Processing": "#A855F7",
  "In Transit": "#22C55E",
  "Delivered": "#14B8A6",
};

export function analyticsStatusBucket(status: DealerOrderStatus): AnalyticsStatusBucket | null {
  switch (status) {
    case "SUBMITTED":
    case "ODOO_SYNC_PENDING":
    case "ODOO_SYNC_FAILED":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return "Quotation Processing";
    case "PFI_ISSUED":
      return "PFI Issued";
    case "AWAITING_PAYMENT":
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
    case "PAYMENT_EXCEPTION":
      return "Awaiting Payment";
    case "PAYMENT_CONFIRMED":
    case "RELEASED_TO_DEPOT":
    case "LOADING":
    case "LOADED":
    case "STOCK_EXCEPTION":
      return "Depot Processing";
    case "DISPATCHED":
    case "IN_TRANSIT":
    case "DELIVERY_EXCEPTION":
      return "In Transit";
    case "DELIVERED":
    case "CLOSED":
      return "Delivered";
    default:
      return null;
  }
}

export function staffStatusPill(status: DealerOrderStatus): {
  label: string;
  tone: string;
} {
  const bucket = analyticsStatusBucket(status);
  const label = bucket ?? dealerStatusLabel(status);
  const tone =
    bucket === "Quotation Processing"
      ? "blue"
      : bucket === "Awaiting Payment"
        ? "gold"
        : bucket === "PFI Issued"
          ? "orange"
          : bucket === "Depot Processing"
            ? "purple"
            : bucket === "In Transit"
              ? "green"
              : bucket === "Delivered"
                ? "teal"
                : "muted";
  return { label, tone };
}

export function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonthLabels(n: number, end = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    out.push({
      key: monthKey(d),
      label: d.toLocaleString("en-GB", { month: "short", year: "numeric" }).replace(" ", " "),
    });
  }
  return out;
}

/** Compact sparkline path for a series of values (viewBox 0 0 120 36). */
export function sparklinePath(values: number[]): string {
  if (!values.length) return "M0 18 L120 18";
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Flat / empty series → centered hairline (avoids a thick line glued to the card bottom)
  if (max === min) return "M0 18 L120 18";
  const span = max - min;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 120;
      const y = 30 - ((v - min) / span) * 24;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
