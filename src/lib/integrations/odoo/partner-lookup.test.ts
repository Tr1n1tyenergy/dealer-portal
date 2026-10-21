import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LiveOdooClient } from "./live-client";

describe("live Odoo client — choosing the customer", () => {
  it("refuses to pick a customer by name: same-name customers would get each other's quotations", async () => {
    const client = new LiveOdooClient();
    const calls: unknown[][] = [];
    // Stand-in Odoo: nothing matches by order key or dealer reference, but two customers share the name.
    (client as unknown as { execute: (...args: unknown[]) => Promise<unknown> }).execute = async (...args) => {
      calls.push(args);
      const domain = JSON.stringify(args[2]);
      if (domain.includes('"name","="')) return [7, 8];
      return [];
    };

    await assert.rejects(
      () =>
        client.createQuotation({
          idempotencyKey: "quotation:DO-2026-000001",
          dealerCode: "ABC",
          dealerName: "ABC Dealers Ltd",
          stationName: "Station",
          lines: [{ product: "PMS", quantityLitres: 1000 }],
        }),
      /No Odoo customer found/,
    );
  });
});
