import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("prisma client", () => {
  it("reuses one client in production instead of opening a new pool on every call", async () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = { node: env.NODE_ENV, url: env.DATABASE_URL };
    env.NODE_ENV = "production";
    env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/none_test";
    try {
      const { prisma } = await import("./prisma");
      // The same client hands back the same model delegate; a new client per access would not.
      assert.equal(prisma.user, prisma.user);
      assert.equal(prisma.dealerOrder, prisma.dealerOrder);
    } finally {
      env.NODE_ENV = saved.node;
      env.DATABASE_URL = saved.url;
    }
  });
});
