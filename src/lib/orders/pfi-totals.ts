/** VAT added on top of the portal's unit price (the EPRA pump price). */
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

/** n × a decimal written as text, rounded half up to a whole number. Exact: 5000 × 195.203703 in floats rounds a half cent down. */
function timesDecimal(n: number, decimal: string): number {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim());
  if (!match) throw new Error(`Not a plain decimal: ${decimal}`);
  const scale = BigInt("1" + "0".repeat((match[3] ?? "").length));
  const magnitude = Number((BigInt(n) * BigInt(match[2] + (match[3] ?? "")) + scale / BigInt(2)) / scale);
  return match[1] ? -magnitude : magnitude;
}

/**
 * PFI money, worked in whole cents: each line is litres × unit price before VAT, the subtotal is
 * the sum of the lines, VAT is the subtotal × rate, and the total is the two added together.
 */
export function pfiTotals(lines: PfiLineInput[], vatRate: string = PFI_VAT_RATE): PfiTotals {
  const priced = lines.map((line) => ({
    ...line,
    cents: timesDecimal(line.quantityLitres * 100, line.unitPriceExVat),
  }));
  const subtotalCents = priced.reduce((sum, line) => sum + line.cents, 0);
  const vatCents = timesDecimal(subtotalCents, vatRate);
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
