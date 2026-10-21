import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

describe("live Odoo client", () => {
  let server: Server;
  const saved = process.env.ODOO_BASE_URL;

  before(async () => {
    // An Odoo that accepts the connection and never answers.
    server = createServer(() => undefined);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.ODOO_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
    if (saved === undefined) delete process.env.ODOO_BASE_URL;
    else process.env.ODOO_BASE_URL = saved;
  });

  it("gives up on an Odoo that never answers instead of hanging", { timeout: 10_000 }, async () => {
    const { LiveOdooClient } = await import("./live-client");
    const client = new LiveOdooClient();
    (client as unknown as { timeoutMs: number }).timeoutMs = 200;

    const started = Date.now();
    await assert.rejects(() => client.getQuotation("1"));
    assert.ok(Date.now() - started < 5_000, "should fail within the timeout, not hang");
  });
});
