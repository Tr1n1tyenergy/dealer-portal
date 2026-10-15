/** Display helpers for the KES amounts stored as text on orders, PFIs and payments. */

function toCents(amount: string | null | undefined): number | null {
  const text = (amount ?? "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

/** "43019000.00" → "KES 43,019,000.00"; empty → "—"; anything that is not a number is shown as typed. */
export function formatKes(amount: string | null | undefined): string {
  if (!amount?.trim()) return "—";
  const cents = toCents(amount);
  if (cents === null) return amount;
  return `KES ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** True when both are numbers and equal to the cent. */
export function sameAmount(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = toCents(a);
  return x !== null && x === toCents(b);
}
