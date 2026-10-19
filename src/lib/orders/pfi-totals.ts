/** VAT added on top of the portal's unit price (EPRA pump price less the station discount). */
export const PFI_VAT_RATE = "0.08";

export type PfiLineInput = { product: "PMS" | "AGO"; quantityLitres: number; unitPriceExVat: string };

export type PfiTotals = {
  lines: Array<PfiLineInput & { amount: string }>;
  subtotal: string;
  vat: string;
  total: string;
  vatRate: string;
};

const toAmount = (cents: number) => (cents / 100).toFixed(2);

/**
 * PFI money, worked in whole cents: each line is litres × unit price before VAT, the subtotal is
 * the sum of the lines, VAT is the subtotal × rate, and the total is the two added together.
 */
export function pfiTotals(lines: PfiLineInput[], vatRate: string = PFI_VAT_RATE): PfiTotals {
  const priced = lines.map((line) => ({
    ...line,
    cents: Math.round(line.quantityLitres * Number(line.unitPriceExVat) * 100),
  }));
  const subtotalCents = priced.reduce((sum, line) => sum + line.cents, 0);
  const vatCents = Math.round(subtotalCents * Number(vatRate));
  return {
    lines: priced.map(({ cents, ...line }) => ({ ...line, amount: toAmount(cents) })),
    subtotal: toAmount(subtotalCents),
    vat: toAmount(vatCents),
    total: toAmount(subtotalCents + vatCents),
    vatRate,
  };
}

/** "1110777.78" → "1,110,777.78" */
export function formatMoney(value: string): string {
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 6000 → "6,000" */
export function formatVolume(litres: number): string {
  return litres.toLocaleString("en-US");
}
