import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PFI_BANK_ACCOUNTS } from "@/lib/company/pfi-settings";
import { balanceAfterConfirming, buildReceiptPreview, parseReceiptEdits, paymentDraftValues } from "@/lib/orders/receipt-preview";

const equity = PFI_BANK_ACCOUNTS[1];
const kcb = PFI_BANK_ACCOUNTS[0];
const base = {
  method: "MANUAL" as const,
  amount: "2193200.00",
  bankReference: "FT26328DYBZ4",
  dealerName: "SURE TECHNOLOGIES CO. LIMITED",
  partnerId: 88,
  partnerExternalId: "dealer-sure",
  accountingDate: "2026-11-25",
  transactionDate: null,
  automaticReceipting: true,
};

describe("receipt preview", () => {
  it("maps an Equity payment to the Equity journal and bank account", () => {
    const preview = buildReceiptPreview({ ...base, accountNumber: equity.accountNumber });
    const draft = paymentDraftValues({ ...base, accountNumber: equity.accountNumber });
    const value = (label: string) => preview.rows.find((row) => row.label === label)?.value;

    assert.equal(value("Internal Transfer"), "No");
    assert.equal(value("Payment Type"), "Receive");
    assert.equal(value("Journal"), "Equity - KES");
    assert.equal(value("Company Bank Account"), `${equity.accountNumber} - ${equity.bank}`);
    assert.equal(value("Date"), "25 Nov 2026");
    assert.equal(draft.journalId, equity.odoo.journalId);
    assert.equal(draft.partnerBankId, equity.odoo.partnerBankId);
    assert.equal(draft.paymentMethodLineId, equity.odoo.paymentMethodLineId);
    assert.equal(draft.reference, "FT26328DYBZ4");
    assert.equal(draft.amount, "2193200.00");
    assert.equal(draft.isInternalTransfer, false);
    assert.equal(draft.paymentType, "inbound");
    assert.equal(preview.canReceipt, true);
  });

  it("maps a KCB payment to the KCB journal, not the Equity journal", () => {
    const draft = paymentDraftValues({ ...base, accountNumber: kcb.accountNumber, amount: "100.00" });
    assert.equal(draft.journalId, kcb.odoo.journalId);
    assert.notEqual(draft.journalId, equity.odoo.journalId);
    assert.equal(draft.partnerBankId, kcb.odoo.partnerBankId);
  });

  it("blocks receipting when the customer, journal, or reference is missing", () => {
    const missingCustomer = buildReceiptPreview({ ...base, partnerId: null, partnerExternalId: null, accountNumber: equity.accountNumber });
    assert.equal(missingCustomer.canReceipt, false);
    assert.match(missingCustomer.blockers.join(" "), /not linked/i);

    const missingJournal = buildReceiptPreview({ ...base, accountNumber: "000" });
    assert.equal(missingJournal.canReceipt, false);
    assert.match(missingJournal.rows.find((row) => row.label === "Journal")?.value ?? "", /No journal/);

    const missingRef = buildReceiptPreview({ ...base, accountNumber: equity.accountNumber, bankReference: "  " });
    assert.equal(missingRef.canReceipt, false);
  });

  it("keeps the preview when automatic receipting is off and refuses to post", () => {
    const preview = buildReceiptPreview({ ...base, accountNumber: equity.accountNumber, automaticReceipting: false });
    assert.equal(preview.canReceipt, false);
    assert.equal(preview.rows.find((row) => row.label === "Amount")?.value, "2,193,200.00");
    assert.match(preview.blockers.join(" "), /off/);
  });

  it("accepts an edited amount, reference and either journal", () => {
    const equityEdit = parseReceiptEdits({ amount: "100.5", reference: " FT1 ", journalId: equity.odoo.journalId, currencyId: 92 });
    assert.equal(equityEdit.ok, true);
    if (equityEdit.ok) {
      assert.equal(equityEdit.amount, "100.50");
      assert.equal(equityEdit.reference, "FT1");
      assert.equal(equityEdit.journal.accountNumber, equity.accountNumber);
    }
    const kcbEdit = parseReceiptEdits({ amount: "10", reference: "ABC", journalId: kcb.odoo.journalId, currencyId: 92 });
    assert.equal(kcbEdit.ok, true);
    if (kcbEdit.ok) assert.equal(kcbEdit.journal.journalId, kcb.odoo.journalId);
    assert.equal(parseReceiptEdits({ amount: "0", reference: "ABC", journalId: equity.odoo.journalId, currencyId: 92 }).ok, false);
    assert.equal(parseReceiptEdits({ amount: "10", reference: "  ", journalId: equity.odoo.journalId, currencyId: 92 }).ok, false);
    assert.equal(parseReceiptEdits({ amount: "10", reference: "ABC", journalId: 999, currencyId: 92 }).ok, false);
  });

  it("projects the balance from this payment only", () => {
    assert.equal(balanceAfterConfirming(219320000, 0, 219320000), 0);
    assert.equal(balanceAfterConfirming(219320000, 100000000, 50000000), 69320000);
    assert.equal(balanceAfterConfirming(10000, 0, 15000), 0);
    assert.equal(balanceAfterConfirming(null, 0, 100), null);
  });
});
