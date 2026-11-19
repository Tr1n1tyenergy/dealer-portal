import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { MockOdooClient } from "./client";
import { odooPaymentsEnabled } from "./config";

describe("mock Odoo payments", () => {
  const draft = {
    idempotencyKey: "payment:mock-1",
    dealerCode: "D-1",
    dealerName: "Test Dealer Ltd",
    amount: "400.00",
    date: "2026-11-19",
    reference: "FT1",
    journalId: 23,
    paymentMethodLineId: 28,
    partnerBankId: 492,
  };

  it("creates a draft, posts it and cancels another", async () => {
    const odoo = new MockOdooClient();
    const a = await odoo.createPaymentDraft(draft);
    assert.equal(a.state, "draft");
    assert.ok(a.id > 900000);
    assert.deepEqual(await odoo.createPaymentDraft(draft), a, "same key → same draft");
    assert.equal((await odoo.postPayment(a.id)).state, "posted");
    const b = await odoo.createPaymentDraft({ ...draft, idempotencyKey: "payment:mock-2" });
    assert.equal((await odoo.cancelPayment(b.id)).state, "cancel");
  });

  it("knows two test M-PESA codes and nothing else", async () => {
    const odoo = new MockOdooClient();
    assert.equal((await odoo.findMpesaPayment("TEST000001"))?.amount, "1000.00");
    assert.equal((await odoo.findMpesaPayment("TEST500000"))?.amount, "500000.00");
    assert.equal(await odoo.findMpesaPayment("NOPE000000"), null);
  });
});

describe("odooPaymentsEnabled", () => {
  const saved = { mode: process.env.ODOO_MODE, live: process.env.ODOO_PAYMENTS_LIVE };
  afterEach(() => {
    for (const [key, value] of [["ODOO_MODE", saved.mode], ["ODOO_PAYMENTS_LIVE", saved.live]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("is on with mock Odoo, off with live Odoo unless ODOO_PAYMENTS_LIVE=1", () => {
    process.env.ODOO_MODE = "mock";
    delete process.env.ODOO_PAYMENTS_LIVE;
    assert.equal(odooPaymentsEnabled(), true);
    process.env.ODOO_MODE = "live";
    assert.equal(odooPaymentsEnabled(), false);
    process.env.ODOO_PAYMENTS_LIVE = "1";
    assert.equal(odooPaymentsEnabled(), true);
  });
});
