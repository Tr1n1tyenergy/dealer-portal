/**
 * Fixed details printed on every portal PFI (from Trinity's Odoo "PRO-FORMA INVOICE" template).
 * Signatory names are copied onto each PFI when it is issued, so changing them here does not
 * rewrite PFIs already issued.
 */
export const PFI_SIGNATORIES = {
  preparedBy: "EVAN OTIATO",
  approvedBy: "EVAN OTIATO",
} as const;

export const PFI_BANK_ACCOUNTS = [
  {
    bank: "KCB Bank Kenya Limited 2 - Kes",
    beneficiary: "TRINITY ENERGY (KENYA) LIMITED",
    accountNumber: "1289725640",
    beneficiaryBank: "KCB Bank Kenya Limited 2 - Kes",
    swiftCode: "",
    /** Odoo account.journal 23 "1289725640 - KCB Bank Kenya Limited 2 - Kes" (not journal 12, same bank). */
    odoo: { journalId: 23, paymentMethodLineId: 28, partnerBankId: 492 },
  },
  {
    bank: "EQUITY BANK (KENYA) LIMITED - KES",
    beneficiary: "TRINITY ENERGY (KENYA) LIMITED",
    accountNumber: "1080281394514",
    beneficiaryBank: "EQUITY BANK (KENYA) LIMITED - KES",
    swiftCode: "",
    /** Odoo account.journal 6 "Equity - KES". */
    odoo: { journalId: 6, paymentMethodLineId: 1, partnerBankId: 367 },
  },
] as const;

/** Safaricom's limit for one M-PESA payment (Adrian, 19 Nov 2026). */
export const MPESA_MAX_PER_PAYMENT = 500_000;

/** Trinity's M-PESA paybill shown to dealers; empty hides the line until Finance confirms it. */
export const MPESA_PAYBILL = "";

export const PFI_COMPANY = {
  name: "TRINITY ENERGY KENYA LIMITED",
  email: "info@trinityenergyltd.com",
  website: "www.trinityenergyltd.com",
  phones: ["+254 704 200 900", "+254 780 200 900"],
  address: ["8th floor, Delta Chambers Building,", "Waiyaki Way, Westlands,", "Nairobi, Kenya"],
  paymentTerms: "Immediate Payment",
  currency: "KES",
} as const;
