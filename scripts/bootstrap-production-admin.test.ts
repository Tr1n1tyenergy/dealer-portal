import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TRI_BOOTSTRAP_ADVISORY_LOCK_KEY,
  createSoleSuperAdmin,
} from "./bootstrap-production-admin";

describe("createSoleSuperAdmin concurrency guard", () => {
  it("takes advisory lock before counting and creates exactly one admin shape", async () => {
    const calls: string[] = [];
    let userCount = 0;
    let created: Record<string, unknown> = {};

    const tx = {
      async $executeRawUnsafe(sql: string) {
        calls.push(sql);
        assert.match(sql, new RegExp(`pg_advisory_xact_lock\\(${TRI_BOOTSTRAP_ADVISORY_LOCK_KEY}\\)`));
      },
      user: {
        async count() {
          calls.push("count");
          return userCount;
        },
        async create(args: { data: Record<string, unknown> }) {
          calls.push("create");
          userCount += 1;
          created = args.data;
          return args.data;
        },
      },
    };

    await createSoleSuperAdmin(tx, {
      email: "admin@example.com",
      passwordHash: "hashed-not-a-password",
      firstName: "Super",
      lastName: "Admin",
    });

    assert.deepEqual(calls[0]?.includes("pg_advisory_xact_lock"), true);
    assert.equal(calls[1], "count");
    assert.equal(calls[2], "create");
    assert.equal(created?.role, "SUPER_ADMIN");
    assert.equal(created?.accountType, "INTERNAL");
    assert.equal(created?.status, "ACTIVE");
    assert.equal(created?.email, "admin@example.com");
    assert.equal(created?.passwordHash, "hashed-not-a-password");
    assert.equal(typeof created?.permissions, "string");
  });

  it("refuses when users already exist after lock", async () => {
    const tx = {
      async $executeRawUnsafe() {},
      user: {
        async count() {
          return 1;
        },
        async create() {
          throw new Error("should not create");
        },
      },
    };

    await assert.rejects(
      () =>
        createSoleSuperAdmin(tx, {
          email: "admin@example.com",
          passwordHash: "hash",
          firstName: "Super",
          lastName: "Admin",
        }),
      /already has 1/
    );
  });
});
