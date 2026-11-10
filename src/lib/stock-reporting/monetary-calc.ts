import { litresToCents, centsToLitres } from "./pump-calc";

/** Balance tolerance: 1 cent (KES 0.01). */
export const MONETARY_BALANCE_EPS_CENTS = 1;

export type MonetaryProductLine = {
  product: "PMS" | "AGO";
  volumeLitres: number;
  priceKesPerLitre: number | null;
  expectedKes: number | null;
};

export type MonetarySummary = {
  lines: MonetaryProductLine[];
  expectedPmsKes: number | null;
  expectedAgoKes: number | null;
  expectedTotalKes: number | null;
  cashKes: number | null;
  mpesaKes: number | null;
  cardKes: number | null;
  collectionsTotalKes: number | null;
  /** Collections − Expected (signed). Null when incomplete. */
  differenceKes: number | null;
  pricesComplete: boolean;
  collectionsComplete: boolean;
  state: "INCOMPLETE" | "BALANCED" | "SHORTAGE" | "OVERAGE";
};

/** Convert KES amount to integer cents. */
export function kesToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToKes(cents: number): number {
  return cents / 100;
}

export function parseKesInput(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return centsToKes(kesToCents(n));
}

export function formatKesFixed(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatKesWithCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `KES ${formatKesFixed(value)}`;
}

export function formatKesSigned(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = formatKesFixed(Math.abs(value));
  if (value < -centsToKes(MONETARY_BALANCE_EPS_CENTS)) return `−KES ${abs}`;
  if (value > centsToKes(MONETARY_BALANCE_EPS_CENTS)) return `KES ${abs}`;
  return `KES ${abs}`;
}

/**
 * Expected amount (KES) = volume (L) × price (KES/L).
 * Uses centilitre × price-cents / 100 to stay decimal-safe at 2dp money.
 */
export function expectedAmountKes(volumeLitres: number, priceKesPerLitre: number): number {
  const volumeCents = litresToCents(volumeLitres);
  const priceCents = kesToCents(priceKesPerLitre);
  // (L * 100) * (KES * 100) / 100 = L * KES * 100 = money cents
  return centsToKes(Math.round((volumeCents * priceCents) / 100));
}

export function computeMonetarySummary(input: {
  meterPms: number;
  meterAgo: number;
  pricePms: number | null;
  priceAgo: number | null;
  cashKes: number | null;
  mpesaKes: number | null;
  cardKes: number | null;
}): MonetarySummary {
  const pricesComplete = input.pricePms != null && input.priceAgo != null;
  const expectedPmsKes =
    input.pricePms != null ? expectedAmountKes(input.meterPms, input.pricePms) : null;
  const expectedAgoKes =
    input.priceAgo != null ? expectedAmountKes(input.meterAgo, input.priceAgo) : null;
  const expectedTotalKes =
    expectedPmsKes != null && expectedAgoKes != null
      ? centsToKes(kesToCents(expectedPmsKes) + kesToCents(expectedAgoKes))
      : null;

  const collectionsComplete =
    input.cashKes != null && input.mpesaKes != null && input.cardKes != null;
  const collectionsTotalKes = collectionsComplete
    ? centsToKes(
        kesToCents(input.cashKes!) + kesToCents(input.mpesaKes!) + kesToCents(input.cardKes!)
      )
    : null;

  let differenceKes: number | null = null;
  let state: MonetarySummary["state"] = "INCOMPLETE";

  if (pricesComplete && collectionsComplete && expectedTotalKes != null && collectionsTotalKes != null) {
    differenceKes = centsToKes(kesToCents(collectionsTotalKes) - kesToCents(expectedTotalKes));
    const diffC = kesToCents(differenceKes);
    if (Math.abs(diffC) <= MONETARY_BALANCE_EPS_CENTS) state = "BALANCED";
    else if (diffC < 0) state = "SHORTAGE";
    else state = "OVERAGE";
  }

  return {
    lines: [
      {
        product: "PMS",
        volumeLitres: centsToLitres(litresToCents(input.meterPms)),
        priceKesPerLitre: input.pricePms,
        expectedKes: expectedPmsKes,
      },
      {
        product: "AGO",
        volumeLitres: centsToLitres(litresToCents(input.meterAgo)),
        priceKesPerLitre: input.priceAgo,
        expectedKes: expectedAgoKes,
      },
    ],
    expectedPmsKes,
    expectedAgoKes,
    expectedTotalKes,
    cashKes: input.cashKes,
    mpesaKes: input.mpesaKes,
    cardKes: input.cardKes,
    collectionsTotalKes,
    differenceKes,
    pricesComplete,
    collectionsComplete,
    state,
  };
}

/**
 * Collections may differ from expected sales by up to this much and still close normally.
 * shortcut: KES 100 is a placeholder until Finance sets the tolerance; change it here.
 */
export const MONETARY_CLOSE_TOLERANCE_KES = 100;
/** Shortest explanation accepted for closing beyond the tolerance. */
export const MONETARY_REASON_MIN_CHARS = 10;

/**
 * Why the shift cannot close yet, or null when it can. Within the tolerance it closes as is;
 * beyond it, it closes only with an explanation (the report keeps its SHORTAGE/OVERAGE state).
 */
export function closeShiftBlock(summary: MonetarySummary, reason: string | null | undefined): string | null {
  if (!summary.collectionsComplete || summary.differenceKes == null) {
    return "Enter Cash, M-Pesa and Visa/Card collections before closing the shift.";
  }
  const diffCents = kesToCents(summary.differenceKes);
  if (Math.abs(diffCents) <= kesToCents(MONETARY_CLOSE_TOLERANCE_KES)) return null;
  if ((reason ?? "").trim().length >= MONETARY_REASON_MIN_CHARS) return null;
  const kind = diffCents < 0 ? "shortage" : "overage";
  return `Collection ${kind} of KES ${formatKesFixed(Math.abs(summary.differenceKes))}. Add an explanation (at least ${MONETARY_REASON_MIN_CHARS} characters) to close the shift with this difference.`;
}
