import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransition } from "./state-machine";
import {
  bankAccountByNumber,
  centsToAmount,
  orderStatusAfterReview,
  parseMpesaCode,
  parseSafaricomPhone,
  paymentClaimKey,
  paymentTotals,
  toCents,
} from "./payments";

describe("paymentTotals", () => {
  it("splits confirmed, waiting and balance; flagged payments don't count", () => {
    assert.deepEqual(
      paymentTotals("7362144.00", [
        { amount: "3000000.00", status: "CONFIRMED" },
        { amount: "250000.00", status: "VERIFICATION" },
        { amount: "1000000.00", status: "REJECTED" },
      ]),
      { totalCents: 736214400, confirmedCents: 300000000, waitingCents: 25000000, balanceCents: 411214400 }
    );
  });

  it("has no balance without a PFI total and never goes below zero", () => {
    assert.equal(paymentTotals(null, []).balanceCents, null);
    assert.equal(paymentTotals("100.00", [{ amount: "150.00", status: "CONFIRMED" }]).balanceCents, 0);
  });

  it("reads amounts with commas and converts cents back", () => {
    assert.equal(toCents("1,234.5"), 123450);
    assert.equal(toCents("abc"), null);
    assert.equal(centsToAmount(123450), "1234.50");
  });
});

describe("orderStatusAfterReview", () => {
  it("moves the order by what is confirmed and what still waits", () => {
    assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 100, waitingCents: 0, balanceCents: 0 }), "PAYMENT_CONFIRMED");
    assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 40, waitingCents: 10, balanceCents: 50 }), "PAYMENT_VERIFICATION");
    assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 40, waitingCents: 0, balanceCents: 60 }), "AWAITING_PAYMENT");
    assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 0, waitingCents: 0, balanceCents: 100 }), "PAYMENT_EXCEPTION");
  });

  it("allows a part-paid order back to awaiting payment", () => {
    assert.equal(canTransition("PAYMENT_VERIFICATION", "AWAITING_PAYMENT"), true);
  });
});

describe("M-PESA codes and phones", () => {
  it("normalises codes and refuses the wrong shape", () => {
    assert.deepEqual(parseMpesaCode(" tkj4ab12cd "), { ok: true, value: "TKJ4AB12CD" });
    assert.equal(parseMpesaCode("TKJ4AB12C").ok, false);
    assert.equal(parseMpesaCode("TKJ4AB-12CD").ok, false);
  });

  it("takes 07, 01 and +254 numbers", () => {
    assert.deepEqual(parseSafaricomPhone("0712 345 678"), { ok: true, value: "254712345678" });
    assert.deepEqual(parseSafaricomPhone("+254112345678"), { ok: true, value: "254112345678" });
    assert.deepEqual(parseSafaricomPhone("254712345678"), { ok: true, value: "254712345678" });
    assert.equal(parseSafaricomPhone("0812345678").ok, false);
    assert.equal(parseSafaricomPhone("07123").ok, false);
  });
});

describe("bank accounts and claim keys", () => {
  it("maps each Trinity account to its Odoo journal, method line and bank", () => {
    assert.deepEqual(bankAccountByNumber("1289725640")?.odoo, { journalId: 23, paymentMethodLineId: 28, partnerBankId: 492 });
    assert.equal(bankAccountByNumber("1080281394514")?.odoo.paymentMethodLineId, 1);
    assert.equal(bankAccountByNumber("999"), null);
  });

  it("builds one key per real-world payment", () => {
    assert.equal(
      paymentClaimKey({ method: "MANUAL", bankAccountNumber: "1289725640", bankReference: " ft26 323kx9ql " }),
      "BANK:1289725640:FT26323KX9QL"
    );
    assert.equal(paymentClaimKey({ method: "MPESA_CODE", mpesaCode: "TKJ4AB12CD" }), "MPESA:TKJ4AB12CD");
    assert.equal(paymentClaimKey({ method: "MANUAL", bankAccountNumber: null, bankReference: null }), null);
  });
});
