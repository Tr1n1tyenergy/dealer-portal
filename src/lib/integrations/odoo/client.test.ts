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
  });

  it("does not issue a second pro-forma for the same quotation", async () => {
    const client = new MockOdooClient();
    const quotation = await client.createQuotation({ ...sample, idempotencyKey: "quotation:order-2" });
    const first = await client.generateProForma(quotation.id);
    const second = await client.generateProForma(quotation.id);
    assert.equal(first.number, second.number);
    assert.equal(first.id, second.id);
  });
});
