import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

type Call = { model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> };

/** A fake Odoo: records every execute_kw call and answers from `answer`. */
describe("live Odoo client: payments", () => {
  let server: Server;
  const calls: Call[] = [];
  let answer: (call: Call) => unknown = () => null;
  const saved = { ...process.env };

  before(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const { params } = JSON.parse(body);
        let result: unknown;
        if (params.service === "common") result = 7;
        else {
          const [, , , model, method, args, kwargs] = params.args;
          const call = { model, method, args, kwargs };
          calls.push(call);
          result = answer(call);
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    Object.assign(process.env, {
      ODOO_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      ODOO_MODE: "live",
      ODOO_USERNAME: "test@example.com",
      ODOO_API_KEY: "not-a-real-key",
      ODOO_PAYMENTS_LIVE: "1",
    });
  });

  beforeEach(() => {
    calls.length = 0;
    answer = () => null;
    process.env.ODOO_PAYMENTS_LIVE = "1";
  });

  after(() => {
    server.close();
    for (const key of ["ODOO_BASE_URL", "ODOO_MODE", "ODOO_USERNAME", "ODOO_API_KEY", "ODOO_PAYMENTS_LIVE"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const draft = {
    idempotencyKey: "payment:p1",
    dealerCode: "D-1",
    dealerName: "Test Dealer Ltd",
    odooPartnerId: 4242,
    amount: "600000.00",
    date: "2026-11-19",
    reference: "FT26323KX9QL",
    journalId: 23,
    paymentMethodLineId: 28,
    partnerBankId: 492,
  };

  async function client() {
    const { LiveOdooClient } = await import("./live-client");
    return new LiveOdooClient();
  }

  it("creates the draft with exactly the fields Accounts fills in by hand", async () => {
    answer = (c) => (c.method === "search" ? [] : c.method === "create" ? 77 : null);
    const result = await (await client()).createPaymentDraft(draft);
    assert.deepEqual(result, { id: 77, state: "draft" });
    const create = calls.find((c) => c.method === "create")!;
    assert.equal(create.model, "account.payment");
    assert.deepEqual(create.args, [
      {
        is_internal_transfer: false,
        payment_type: "inbound",
        partner_type: "customer",
        partner_id: 4242,
        amount: 600000,
        currency_id: 92,
        date: "2026-11-19",
        ref: "FT26323KX9QL",
        journal_id: 23,
        payment_method_line_id: 28,
        partner_bank_id: 492,
      },
    ]);
  });

  it("reuses an existing matching draft instead of creating a second one", async () => {
    answer = (c) => (c.method === "search" ? [77] : null);
    const result = await (await client()).createPaymentDraft(draft);
    assert.deepEqual(result, { id: 77, state: "draft" });
    assert.equal(calls.some((c) => c.method === "create"), false);
    assert.deepEqual(calls[0].args, [
      [
        ["partner_id", "=", 4242],
        ["journal_id", "=", 23],
        ["amount", "=", 600000],
        ["ref", "=", "FT26323KX9QL"],
        ["state", "=", "draft"],
      ],
    ]);
  });

  it("posts with action_post and reports the state Odoo ends in", async () => {
    answer = (c) => (c.method === "read" ? [{ id: 77, state: "awaitV" }] : true);
    const result = await (await client()).postPayment(77);
    assert.deepEqual(result, { id: 77, state: "awaitV" });
    assert.deepEqual(calls[0], { model: "account.payment", method: "action_post", args: [[77]], kwargs: {} });
  });

  it("cancels with action_cancel", async () => {
    answer = (c) => (c.method === "read" ? [{ id: 77, state: "cancel" }] : true);
    assert.deepEqual(await (await client()).cancelPayment(77), { id: 77, state: "cancel" });
    assert.equal(calls[0].method, "action_cancel");
  });

  it("finds an M-PESA payment only when the code is the last part of the reference", async () => {
    answer = () => [
      { id: 1, ref: "MP-25471 - Jane Doe - TKJ4AB12CD", amount: 120000, date: "2026-11-19", state: "posted" },
      { id: 2, ref: "MP-25471 - TKJ4AB12CD Ltd - XYZ1234567", amount: 50, date: "2026-11-19", state: "posted" },
    ];
    const found = await (await client()).findMpesaPayment("TKJ4AB12CD");
    assert.deepEqual(found, { id: 1, amount: "120000.00", date: "2026-11-19", state: "posted" });
    assert.deepEqual(calls[0].args, [
      [
        ["journal_id", "=", 11],
        ["state", "=", "posted"],
        ["ref", "ilike", "TKJ4AB12CD"],
      ],
    ]);
  });

  it("returns null for an M-PESA code Odoo doesn't have", async () => {
    answer = () => [];
    assert.equal(await (await client()).findMpesaPayment("NOPE000000"), null);
  });

  it("refuses payment writes while Odoo payments are switched off, without calling Odoo", async () => {
    delete process.env.ODOO_PAYMENTS_LIVE;
    const c = await client();
    await assert.rejects(() => c.createPaymentDraft(draft), /switched off/);
    await assert.rejects(() => c.postPayment(77), /switched off/);
    await assert.rejects(() => c.cancelPayment(77), /switched off/);
    assert.equal(calls.length, 0);
  });
});
