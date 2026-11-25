import { PFI_BANK_ACCOUNTS } from "@/lib/company/pfi-settings";
import { ODOO_KES_CURRENCY_ID } from "@/lib/integrations/odoo/config";
import { bankAccountByNumber, toCents } from "@/lib/orders/payments";

/** Journal names read from the live Odoo company. Keyed by the journal id already stored on each bank account. */
const JOURNAL_NAMES: Record<number, string> = {
  6: "Equity - KES",
  23: "1289725640 - KCB Bank Kenya Limited 2 - Kes",
};

export type ReceiptPreviewInput = {
  method: "MANUAL" | "MPESA";
  amount: string;
  bankReference: string | null;
  accountNumber: string | null;
  dealerName: string;
  /** Resolved Odoo customer id, or null when the dealer is not linked. */
  partnerId: number | null;
  /** Dealer external id. The payment writer can resolve the customer from this when no numeric id is stored. */
  partnerExternalId: string | null;
  /** Africa/Nairobi calendar day the existing payment writer sends as account.payment.date. */
  accountingDate: string;
  /** Stored transaction date, when the payment form actually saved one. */
  transactionDate: string | null;
  automaticReceipting: boolean;
};

export type ReceiptRow = {
  label: string;
  value: string;
  ok: boolean;
};

export type ReceiptPreview = {
  rows: ReceiptRow[];
  blockers: string[];
  /** Shown with the mapping. Does not by itself block a portal-only confirmation. */
  dateNote: string;
  /** True only when a confirm click is allowed to create or post in Odoo. */
  canReceipt: boolean;
  bank: (typeof PFI_BANK_ACCOUNTS)[number] | null;
};

function groupedAmount(amount: string): string {
  const cents = toCents(amount);
  if (cents == null) return amount;
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * The same account.payment values createPaymentDraft sends.
 * Display labels follow the Odoo form. Technical values are the ones the writer posts.
 */
export function buildReceiptPreview(input: ReceiptPreviewInput): ReceiptPreview {
  const bank = input.method === "MANUAL" ? bankAccountByNumber(input.accountNumber) : null;
  const reference = (input.bankReference ?? "").trim();
  const journalName = bank ? JOURNAL_NAMES[bank.odoo.journalId] ?? bank.bank : null;
  const customerLinked = input.partnerId != null || Boolean(input.partnerExternalId);
  const blockers: string[] = [];

  if (!input.automaticReceipting) {
    blockers.push("Automatic receipting is off. Confirming updates Trinity only. Accounts records this receipt in Odoo.");
  }
  if (input.method === "MPESA") {
    blockers.push("M-PESA is matched to a payment Odoo already posted. This page does not create a second receipt.");
  }
  if (input.method === "MANUAL" && !bank) {
    blockers.push("The account the dealer paid into is not one of Trinity's configured bank accounts.");
  }
  if (input.method === "MANUAL" && !reference) {
    blockers.push("The dealer did not give a bank reference.");
  }
  if (!customerLinked) {
    blockers.push("This dealer is not linked to an Odoo customer. Link the customer before a receipt can be posted.");
  }
  const dateNote = input.transactionDate
    ? "A transaction date is stored on this payment. The receipt writer still sends the Nairobi day the draft is created."
    : "The accounting date is the Nairobi day this receipt is created. This payment has no stored transaction date.";

  const journalMatchesAccount = Boolean(bank && journalName);
  const rows: ReceiptRow[] = [
    { label: "Internal Transfer", value: "No", ok: true },
    { label: "Payment Type", value: "Receive", ok: true },
    {
      label: "Customer",
      value: customerLinked ? input.dealerName : "Not linked to an Odoo customer",
      ok: customerLinked,
    },
    { label: "Amount", value: groupedAmount(input.amount), ok: true },
    { label: "Currency", value: "KES", ok: true },
    { label: "Date", value: formatIsoDate(input.accountingDate), ok: Boolean(input.accountingDate) },
    {
      label: "Bank Reference",
      value: reference || "Missing",
      ok: input.method === "MPESA" ? true : Boolean(reference),
    },
    {
      label: "Journal",
      value: input.method === "MPESA" ? "M-PESA journal (matched, not created here)" : journalName ?? "No journal for this account",
      ok: input.method === "MPESA" ? true : journalMatchesAccount,
    },
    { label: "Payment Method", value: "Manual", ok: input.method === "MPESA" ? true : Boolean(bank) },
    {
      label: "Company Bank Account",
      value: bank ? `${bank.accountNumber} - ${bank.bank}` : input.method === "MPESA" ? "Not used for M-PESA" : "Unknown account",
      ok: input.method === "MPESA" ? true : Boolean(bank),
    },
  ];

  const canReceipt =
    input.automaticReceipting &&
    input.method === "MANUAL" &&
    Boolean(bank) &&
    Boolean(reference) &&
    customerLinked &&
    journalMatchesAccount;

  return { rows, blockers, dateNote, canReceipt, bank };
}

/** Outstanding after this payment is confirmed. Other payments still waiting stay outstanding. */
export function balanceAfterConfirming(
  totalCents: number | null,
  confirmedCents: number,
  paymentCents: number
): number | null {
  if (totalCents == null) return null;
  return Math.max(0, totalCents - confirmedCents - paymentCents);
}

/** What createPaymentDraft writes. Kept beside the preview so the two cannot drift. */
export function paymentDraftValues(input: ReceiptPreviewInput) {
  const preview = buildReceiptPreview(input);
  const bank = preview.bank;
  return {
    isInternalTransfer: false,
    paymentType: "inbound" as const,
    partnerType: "customer" as const,
    partnerId: input.partnerId,
    partnerExternalId: input.partnerExternalId,
    amount: input.amount,
    currencyId: ODOO_KES_CURRENCY_ID,
    date: input.accountingDate,
    reference: (input.bankReference ?? "").trim(),
    journalId: bank?.odoo.journalId ?? null,
    paymentMethodLineId: bank?.odoo.paymentMethodLineId ?? null,
    partnerBankId: bank?.odoo.partnerBankId ?? null,
  };
}

export const CONFIGURED_BANK_ACCOUNTS = PFI_BANK_ACCOUNTS;

export type ReceiptJournal = {
  journalId: number;
  name: string;
  accountNumber: string;
  bank: string;
  paymentMethodLineId: number;
  partnerBankId: number;
  companyBank: string;
};

/** The two Trinity bank journals, keyed by the Odoo journal id stored on each account. */
export function receiptJournals(): ReceiptJournal[] {
  return PFI_BANK_ACCOUNTS.map((account) => ({
    journalId: account.odoo.journalId,
    name: JOURNAL_NAMES[account.odoo.journalId] ?? account.bank,
    accountNumber: account.accountNumber,
    bank: account.bank,
    paymentMethodLineId: account.odoo.paymentMethodLineId,
    partnerBankId: account.odoo.partnerBankId,
    companyBank: `${account.accountNumber} - ${account.bank}`,
  }));
}

export function journalById(journalId: number): ReceiptJournal | null {
  return receiptJournals().find((journal) => journal.journalId === journalId) ?? null;
}

/** Staff edits on the receipt page. Amount and reference must be real; the journal must be one of the two. */
export function parseReceiptEdits(input: {
  amount: string;
  reference: string;
  journalId: number;
  currencyId: number;
}): { ok: true; amount: string; reference: string; journal: ReceiptJournal; currencyId: number } | { ok: false; error: string } {
  const cents = toCents(input.amount);
  if (cents == null || cents <= 0) return { ok: false, error: "Enter the payment amount." };
  const reference = input.reference.trim();
  if (!reference) return { ok: false, error: "Enter the bank reference." };
  const journal = journalById(input.journalId);
  if (!journal) return { ok: false, error: "Choose the Equity or KCB journal." };
  if (!Number.isInteger(input.currencyId) || input.currencyId <= 0) return { ok: false, error: "Choose a currency." };
  return { ok: true, amount: (cents / 100).toFixed(2), reference: reference.slice(0, 100), journal, currencyId: input.currencyId };
}
