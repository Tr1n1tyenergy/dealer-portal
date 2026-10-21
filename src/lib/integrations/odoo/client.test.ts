import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockOdooClient } from "./client";

const sample = {
  idempotencyKey: "quotation:order-1",
  dealerCode: "ABC",
  dealerName: "ABC Dealers Ltd",
  stationName: "Trinity Westlands",
  lines: [
    { product: "PMS" as const, quantityLitres: 20000 },
    { product: "AGO" as const, quantityLitres: 10000 },
  ],
};

describe("mock Odoo adapter", () => {
  it("returns the same quotation when the request is replayed", async () => {
    const client = new MockOdooClient();
    const first = await client.createQuotation(sample);
    const second = await client.createQuotation(sample);
    assert.equal(first.id, second.id);
    assert.equal(first.number, second.number);
    assert.match(first.number, /^MOCK-/);
  });

  it("prices the quotation as litres x unit price, rounded to cents", async () => {
    const client = new MockOdooClient();
    const quotation = await client.createQuotation({
      ...sample,
      idempotencyKey: "quotation:priced-1",
      lines: [
        { product: "PMS", quantityLitres: 100000, unitPrice: 212.92 },
        { product: "AGO", quantityLitres: 100000, unitPrice: 217.27 },
      ],
    });
    assert.equal(quotation.amountTotal, "43019000.00");
  });

  it("rounds each line to cents and counts a line with no price as 0", async () => {
    const client = new MockOdooClient();
    const quotation = await client.createQuotation({
      ...sample,
      idempotencyKey: "quotation:priced-2",
      lines: [
        { product: "PMS", quantityLitres: 3, unitPrice: 0.335 },
        { product: "AGO", quantityLitres: 5000, unitPrice: null },
      ],
    });
    assert.equal(quotation.amountTotal, "1.01");
  });
});
