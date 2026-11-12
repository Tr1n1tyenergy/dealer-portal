import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Any database call fails fast (nothing listens on port 1), so the test proves the
// production guard returns before touching the database.
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";

describe("ensureOfficialStationsInDb", () => {
  it("never writes catalog dealers and stations in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const { ensureOfficialStationsInDb } = await import("./ensure-official-stations");
      assert.equal(await ensureOfficialStationsInDb(), null);
    } finally {
      env.NODE_ENV = before;
    }
  });
});
