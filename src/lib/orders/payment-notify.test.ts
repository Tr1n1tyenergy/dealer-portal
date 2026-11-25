import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentEmail } from "./payment-notify";

const base = {
  orderReference: "TRI-D-2026-0002",
  dealerName: "ABC Dealers Ltd",
  amount: "2193200.00",
  method: "MANUAL" as const,
  bankAccountNumber: "1080281394514",
  bankReference: "FT26328DYBZ4",
  mpesaCode: null,
  sentAt: new Date("2026-11-24T09:21:00Z"),
  reviewUrl: "https://portal.test/intelligence/retail/orders/o1/payment",
};

describe("payment email to Sales Person Executives", () => {
  it("names the amount, dealer and order in the subject", () => {
    assert.equal(paymentEmail(base).subject, "Payment to confirm: KES 2,193,200.00 from ABC Dealers Ltd (TRI-D-2026-0002)");
  });

  it("lists the account, reference and Nairobi time, and links to the review page", () => {
    const { html } = paymentEmail(base);
    assert.match(html, /EQUITY BANK \(KENYA\) LIMITED - KES · 1080281394514/);
    assert.match(html, /FT26328DYBZ4/);
    assert.match(html, /24 Nov 2026, 12:21/);
    assert.match(html, /href="https:\/\/portal\.test\/intelligence\/retail\/orders\/o1\/payment"/);
  });

  it("shows an M-PESA code instead of a bank", () => {
    const { html } = paymentEmail({ ...base, method: "MPESA_CODE", bankAccountNumber: null, bankReference: null, mpesaCode: "TKJ4AB12CD" });
    assert.match(html, /M-PESA/);
    assert.match(html, /TKJ4AB12CD/);
  });

  it("never lets a dealer name or reference inject markup", () => {
    const { subject, html } = paymentEmail({ ...base, dealerName: "<script>x</script> Ltd", bankReference: "<b>REF</b>" });
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<b>REF</b>"));
    assert.match(subject, /<script>x<\/script> Ltd/, "the subject is plain text, so it stays as typed");
  });
});
