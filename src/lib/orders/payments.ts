/**
 * Money and status rules for PFI payments paid in parts (M-PESA code, manual bank payment).
 * Pure: amounts are compared in whole cents, stored as "1234.50" strings like PaymentRecord.amount.
 */
import type { PaymentMethod, PaymentState } from "@prisma/client";
import { PFI_BANK_ACCOUNTS } from "@/lib/company/pfi-settings";
import type { Parsed } from "./order-input";

export type PaymentLike = { amount: string; status: PaymentState };
export type PaymentTotals = {
  totalCents: number | null;
  confirmedCents: number;
  waitingCents: number;
  balanceCents: number | null;
};

const WAITING: PaymentState[] = ["SUBMITTED", "VERIFICATION"];

export function toCents(text: string | null | undefined): number | null {
  const clean = (text ?? "").replace(/,/g, "").trim();
  return /^\d+(\.\d+)?$/.test(clean) ? Math.round(Number(clean) * 100) : null;
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function paymentTotals(pfiAmount: string | null | undefined, payments: PaymentLike[]): PaymentTotals {
  const sum = (states: PaymentState[]) =>
    payments.filter((p) => states.includes(p.status)).reduce((total, p) => total + (toCents(p.amount) ?? 0), 0);
  const totalCents = toCents(pfiAmount);
  const confirmedCents = sum(["CONFIRMED"]);
  const waitingCents = sum(WAITING);
  return {
    totalCents,
    confirmedCents,
    waitingCents,
    balanceCents: totalCents == null ? null : Math.max(0, totalCents - confirmedCents - waitingCents),
  };
}

/** Where the order goes after staff confirm or flag one payment (totals already include that review). */
export function orderStatusAfterReview(
  totals: PaymentTotals
): "PAYMENT_CONFIRMED" | "PAYMENT_VERIFICATION" | "AWAITING_PAYMENT" | "PAYMENT_EXCEPTION" {
  if (totals.totalCents != null && totals.confirmedCents >= totals.totalCents) return "PAYMENT_CONFIRMED";
  if (totals.waitingCents > 0) return "PAYMENT_VERIFICATION";
  return totals.confirmedCents > 0 ? "AWAITING_PAYMENT" : "PAYMENT_EXCEPTION";
}

export function parseMpesaCode(value: unknown): Parsed<string> {
  const code = value == null ? "" : String(value).replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{10}$/.test(code)
    ? { ok: true, value: code }
    : { ok: false, message: "Enter the 10-character M-PESA code from your confirmation SMS." };
}

/** 07XXXXXXXX, 01XXXXXXXX, 2547…/2541… or +254… → "254XXXXXXXXX". */
export function parseSafaricomPhone(value: unknown): Parsed<string> {
  const digits = (value == null ? "" : String(value)).replace(/[\s-]/g, "").replace(/^\+/, "");
  const local = digits.match(/^0([17]\d{8})$/)?.[1] ?? digits.match(/^254([17]\d{8})$/)?.[1];
  return local
    ? { ok: true, value: `254${local}` }
    : { ok: false, message: "Enter an M-PESA number starting 07, 01 or +254." };
}

export function bankAccountByNumber(accountNumber: unknown): (typeof PFI_BANK_ACCOUNTS)[number] | null {
  const wanted = accountNumber == null ? "" : String(accountNumber).trim();
  return PFI_BANK_ACCOUNTS.find((a) => a.accountNumber === wanted) ?? null;
}

/** One key per real-world payment, so the same M-PESA code or bank reference can't be claimed twice. */
export function paymentClaimKey(p: {
  method: PaymentMethod;
  mpesaCode?: string | null;
  bankAccountNumber?: string | null;
  bankReference?: string | null;
}): string | null {
  if (p.method === "MPESA_CODE" && p.mpesaCode) return `MPESA:${p.mpesaCode.trim().toUpperCase()}`;
  const ref = (p.bankReference ?? "").replace(/\s+/g, "").toUpperCase();
  if (p.method === "MANUAL" && p.bankAccountNumber && ref) return `BANK:${p.bankAccountNumber.trim()}:${ref}`;
  return null;
}
