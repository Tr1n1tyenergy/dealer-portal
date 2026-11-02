import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearMockOdooMemory, MockOdooClient } from "./client";

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

  it("does not issue a second pro-forma for the same quotation", async () => {
    const client = new MockOdooClient();
    const quotation = await client.createQuotation({ ...sample, idempotencyKey: "quotation:order-2" });
    const first = await client.generateProForma(quotation.id);
    const second = await client.generateProForma(quotation.id);
    assert.equal(first.number, second.number);
    assert.equal(first.id, second.id);
    assert.match(first.number, /^MOCK-/);
  });

  it("issues a pro-forma for a mock quotation created by another page or before a restart", async () => {
    const client = new MockOdooClient();
    const pfi = await client.generateProForma("mock-quot-quotation:elsewhere-1");
    assert.equal(pfi.quotationId, "mock-quot-quotation:elsewhere-1");
    assert.match(pfi.number, /^MOCK-PFI-/);
  });

  it("still rejects a quotation id that is not a mock quotation", async () => {
    const client = new MockOdooClient();
    await assert.rejects(client.generateProForma("12345"), /not found/i);
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
    assert.equal((await client.generateProForma(quotation.id)).amount, "43019000.00");
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

  it("keeps the PFI amount for a priced quotation rebuilt after a restart", async () => {
    const quotation = await new MockOdooClient().createQuotation({
      ...sample,
      idempotencyKey: "quotation:priced-3",
      lines: [{ product: "PMS", quantityLitres: 5000, unitPrice: 212.92 }],
    });
    const original = await new MockOdooClient().generateProForma(quotation.id);
    clearMockOdooMemory();
    const pfi = await new MockOdooClient().generateProForma(quotation.id);
    assert.equal(pfi.amount, "1064600.00");
    assert.equal(pfi.number, original.number);
  });

  it("still issues a 0.00 pro-forma for an old-style mock quotation id", async () => {
    clearMockOdooMemory();
    const pfi = await new MockOdooClient().generateProForma("mock-quot-quotation:TRI-OLD-1");
    assert.equal(pfi.amount, "0.00");
  });

  it("gives different orders different quotation numbers", async () => {
    // These two order references clashed when the number was cut to 90,000 values.
    const client = new MockOdooClient();
    const a = await client.createQuotation({ ...sample, idempotencyKey: "quotation:DO-2026-003090" });
    const b = await client.createQuotation({ ...sample, idempotencyKey: "quotation:DO-2026-010209" });
    assert.notEqual(a.number, b.number);
  });
});
