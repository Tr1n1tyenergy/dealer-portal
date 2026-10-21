import { EPRA_TEMP_PRICES_BY_WAREHOUSE } from "./epra-temp-prices";

export type PriceListState = "current" | "ending" | "expired";

/** Days before the end date (inclusive) that staff are warned the list is about to run out. */
const ENDING_SOON_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Kenya (EAT) is UTC+3 all year. */
const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The earliest last day of any region's prices, e.g. "2026-11-14". */
export function priceListEndDate(): string {
  return Object.values(EPRA_TEMP_PRICES_BY_WAREHOUSE)
    .map((row) => row.periodTo)
    .sort()[0];
}

/** Midnight at the start of a calendar day in Kenya, as an instant. */
function kenyaMidnight(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) - KENYA_OFFSET_MS;
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Whether the EPRA price list in the portal is still valid, Kenya time. EPRA publishes a new list on
 * the 15th of each month; the portal's list is replaced by hand, so staff are warned when it runs out.
 */
export function priceListStatus(
  now: Date,
  periodTo: string = priceListEndDate(),
): { state: PriceListState; message: string | null } {
  const lastDayStart = kenyaMidnight(periodTo);
  const expiresAt = lastDayStart + DAY_MS;
  const endingFrom = lastDayStart - (ENDING_SOON_DAYS - 1) * DAY_MS;
  const endsOn = formatDay(periodTo);
  const at = now.getTime();

  if (at >= expiresAt) {
    return {
      state: "expired",
      message: `The EPRA price list expired on ${endsOn}. New quotations still use these prices until the list is updated.`,
    };
  }
  if (at >= endingFrom) {
    return {
      state: "ending",
      message: `The EPRA price list ends on ${endsOn}. Update it when EPRA publishes the new list on the 15th.`,
    };
  }
  return { state: "current", message: null };
}
