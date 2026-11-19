import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEALER_PAYABLE_STATUSES, toPayPfiProps } from "./pay-pfi";

const order = (payments: { amount: string; status: "SUBMITTED" | "VERIFICATION" | "CONFIRMED" | "REJECTED" }[]) => ({
  id: "o1",
  reference: "DO-2026-000001",
  amountDue: "1000.00",
  odooQuotationNumber: "S00001",
  station: { name: "Test Station" },
  dealerOrganization: { name: "Test Dealer Ltd" },
  proforma: { number: "S00001", amount: "1000.00", subtotal: "925.93", vatAmount: "74.07", vatRate: "0.08" },
  payments,
});

describe("toPayPfiProps", () => {
  it("shows the balance after confirmed and waiting payments", () => {
    const props = toPayPfiProps(order([
      { amount: "400.00", status: "CONFIRMED" },
      { amount: "100.00", status: "SUBMITTED" },
      { amount: "300.00", status: "REJECTED" },
    ]));
    assert.equal(props?.totalAmount, "1000.00");
    assert.equal(props?.paidAmount, "400.00");
    assert.equal(props?.waitingAmount, "100.00");
    assert.equal(props?.balance, "500.00");
  });

  it("offers no payment once the PFI is covered", () => {
    assert.equal(toPayPfiProps(order([{ amount: "1000.00", status: "CONFIRMED" }])), null);
  });

  it("lets a dealer pay more while a payment is being checked", () => {
    assert.ok(DEALER_PAYABLE_STATUSES.includes("PAYMENT_VERIFICATION"));
  });
});
