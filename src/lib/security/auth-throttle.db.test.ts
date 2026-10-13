import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "sign-in lockout and reset limits",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let throttle: typeof import("./auth-throttle");
    const run = `a${Date.now()}`;
    let sequence = 0;
    const email = () => `user${++sequence}.${run}@example.test`;
    const ip = () => `ip-${run}-${++sequence}`;

    async function fail(times: number, address: string, from: string) {
      for (let i = 0; i < times; i += 1) await throttle.recordLoginFailure(address, from);
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      throttle = await import("./auth-throttle");
    });

    after(async () => {
      await prisma.authAttempt.deleteMany({
        where: { OR: [{ email: { contains: run } }, { ip: { contains: run } }] },
      });
      await prisma.$disconnect();
    });

    it("does not lock after four failures", async () => {
      const address = email();
      await fail(4, address, ip());

      assert.deepEqual(await throttle.checkLoginLock(address, ip()), { locked: false });
    });

    it("locks an email on the fifth failure", async () => {
      const address = email();
      await fail(5, address, ip());

      const lock = await throttle.checkLoginLock(address, ip());

      assert.equal(lock.locked, true);
      if (!lock.locked) return;
      assert.ok(lock.retryAfterSeconds >= 1 && lock.retryAfterSeconds <= 900, `${lock.retryAfterSeconds}`);
    });

    it("counts differently-cased emails together", async () => {
      const address = email();
      await fail(3, address, ip());
      await fail(2, `  ${address.toUpperCase()} `, ip());

      assert.equal((await throttle.checkLoginLock(address, ip())).locked, true);
    });

    it("locks after five simultaneous failures", async () => {
      const address = email();
      const from = ip();
      await Promise.all(Array.from({ length: 5 }, () => throttle.recordLoginFailure(address, from)));

      assert.equal((await throttle.checkLoginLock(address, ip())).locked, true);
    });

    it("lets at most five of twenty simultaneous sign-ins through to the password check", async () => {
      const address = email();
      const from = ip();

      const results = await Promise.all(Array.from({ length: 20 }, () => throttle.beginLoginAttempt(address, from)));

      const through = results.filter((r) => !r.locked).length;
      assert.ok(through <= 5, `${through} got through`);
      // Only the attempts that got through stay recorded (as failures until a success clears them).
      assert.equal(await prisma.authAttempt.count({ where: { email: address } }), through);
    });

    it("sends at most three of ten simultaneous reset requests", async () => {
      const address = email();

      const results = await Promise.all(Array.from({ length: 10 }, () => throttle.allowPasswordReset(address, ip())));

      assert.ok(results.filter(Boolean).length <= 3, `${results.filter(Boolean).length} allowed`);
    });

    it("unlocks once failures are older than the window", async () => {
      const address = email();
      await fail(5, address, ip());
      await prisma.authAttempt.updateMany({
        where: { email: address },
        data: { createdAt: new Date(Date.now() - 16 * 60_000) },
      });

      assert.equal((await throttle.checkLoginLock(address, ip())).locked, false);
    });

    it("clears an email's failures after a successful login", async () => {
      const address = email();
      await fail(5, address, ip());

      await throttle.clearLoginFailures(address);

      assert.equal((await throttle.checkLoginLock(address, ip())).locked, false);
    });

    it("blocks an IP after 30 failures across different emails", async () => {
      const from = ip();
      for (let i = 0; i < 30; i += 1) await throttle.recordLoginFailure(email(), from);

      assert.equal((await throttle.checkLoginLock(email(), from)).locked, true);
    });

    it("does not lock another email from the same IP below the IP cap", async () => {
      const from = ip();
      await fail(5, email(), from);

      assert.equal((await throttle.checkLoginLock(email(), from)).locked, false);
    });

    it("allows three reset emails per address per hour, then refuses", async () => {
      const address = email();
      const results = [];
      for (let i = 0; i < 4; i += 1) results.push(await throttle.allowPasswordReset(address, ip()));

      assert.deepEqual(results, [true, true, true, false]);
    });

    it("allows ten reset requests per IP per hour, then refuses", async () => {
      const from = ip();
      const results = [];
      for (let i = 0; i < 11; i += 1) results.push(await throttle.allowPasswordReset(email(), from));

      assert.deepEqual(results, [...Array(10).fill(true), false]);
    });

    it("deletes attempts older than 24 hours on write", async () => {
      const address = email();
      await prisma.authAttempt.create({
        data: { kind: "LOGIN_FAILURE", email: address, ip: ip(), createdAt: new Date(Date.now() - 25 * 3_600_000) },
      });

      await throttle.recordLoginFailure(email(), ip());

      assert.equal(await prisma.authAttempt.count({ where: { email: address } }), 0);
    });
  }
);
