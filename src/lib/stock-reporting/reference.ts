/**
 * Official stock-sale report reference.
 * Format: SSR-{STATION_CODE}-{YYYY-MM-DD} using the Nairobi reporting date.
 * Generated once on close and persisted — never regenerated on refresh.
 */

export function stationCodeForReference(stationCode: string | null | undefined): string {
  const cleaned = (stationCode ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned || "UNK";
}

export function formatReportingDateIso(reportingDate: Date): string {
  const y = reportingDate.getUTCFullYear();
  const m = String(reportingDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(reportingDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildStockReportReference(params: {
  stationCode: string | null | undefined;
  reportingDate: Date;
}): string {
  const code = stationCodeForReference(params.stationCode);
  const date = formatReportingDateIso(params.reportingDate);
  return `SSR-${code}-${date}`;
}

export function wetResolutionLabel(
  resolution: string,
  state: string
): string {
  switch (resolution) {
    case "RECORD_LOSS":
      return "Recorded as Loss";
    case "MATCH_DELIVERY":
      return "Matched Stock Delivery";
    case "REVIEW_READINGS":
      return "Corrected Readings";
    case "BALANCED":
      return "Balanced";
    default:
      if (state === "RECONCILED" || state === "VARIANCE_RECORDED") return "Reconciled";
      if (state === "BALANCED") return "Balanced";
      return "—";
  }
}

export function wetSidebarStatus(resolution: string, state: string): string {
  if (resolution === "BALANCED" || state === "BALANCED" || state === "RECONCILED") {
    return "Reconciled";
  }
  if (resolution === "RECORD_LOSS" || state === "VARIANCE_RECORDED") return "Reconciled";
  if (state === "PENDING_APPROVAL") return "Pending Approval";
  return "Completed";
}

export function monetarySidebarStatus(state: string): string {
  switch (state) {
    case "BALANCED":
      return "Balanced";
    case "SHORTAGE":
      return "Shortage";
    case "OVERAGE":
      return "Overage";
    default:
      return "Completed";
  }
}
