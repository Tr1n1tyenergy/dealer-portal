import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "saving a person's permissions",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let savePermissions: typeof import("./permissions-admin").savePermissions;
    const run = `pa${Date.now()}`;
    const ids: Record<"admin" | "spe" | "dealer", string> = { admin: "", spe: "", dealer: "" };
    let otherAdmins: { id: string; status: string }[] = [];

    const actor = async (key: keyof typeof ids) => prisma.user.findUniqueOrThrow({ where: { id: ids[key] } });

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      ({ savePermissions } = await import("./permissions-admin"));
      // This suite needs to control who the active Admins are; park any others for its duration.
      otherAdmins = await prisma.user.findMany({
        where: { role: "SUPER_ADMIN", status: "ACTIVE", accountType: "INTERNAL" },
        select: { id: true, status: true },
      });
      await prisma.user.updateMany({ where: { id: { in: otherAdmins.map((u) => u.id) } }, data: { status: "DISABLED" } });
      for (const [key, role, accountType] of [
        ["admin", "SUPER_ADMIN", "INTERNAL"],
        ["spe", "SALES_PERSON_EXECUTIVE", "INTERNAL"],
        ["dealer", "DEALER_ADMIN", "DEALER"],
      ] as const) {
        ids[key] = (
          await prisma.user.create({
            data: { firstName: "T", lastName: key, email: `${key}.${run}@example.test`, department: "T", role, accountType, status: "ACTIVE" },
          })
        ).id;
      }
    });

    after(async () => {
      await prisma.activityLog.deleteMany({ where: { entityId: { in: Object.values(ids) } } });
      await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
      for (const u of otherAdmins) await prisma.user.update({ where: { id: u.id }, data: { status: u.status as "ACTIVE" } });
    });

    it("refuses someone without Act on Admin Users", async () => {
      const result = await savePermissions(await actor("spe"), ids.spe, [{ key: "settings.view", value: "allow" }]);
      assert.deepEqual(result.ok ? null : result.status, 403);
    });

    it("refuses dealers as targets, unknown keys and too many changes", async () => {
      const admin = await actor("admin");
      assert.deepEqual((await savePermissions(admin, ids.dealer, [])).ok ? null : 400, 400);
      const unknown = await savePermissions(admin, ids.spe, [{ key: "x.view", value: "allow" }]);
      assert.match(unknown.ok ? "" : unknown.message, /Unknown permission/);
      const many = Array.from({ length: 15 }, () => ({ key: "orders.act", value: "deny" as const }));
      assert.equal((await savePermissions(admin, ids.spe, many)).ok, false);
    });

    it("saves ticks, removes them with inherit, and logs before and after", async () => {
      const admin = await actor("admin");
      const saved = await savePermissions(admin, ids.spe, [{ key: "orders.act", value: "deny" }]);
      assert.deepEqual(saved, { ok: true, permissions: '{"orders.act":"deny"}' });
      const cleared = await savePermissions(admin, ids.spe, [{ key: "orders.act", value: "inherit" }]);
      assert.deepEqual(cleared, { ok: true, permissions: "{}" });
      const log = await prisma.activityLog.findFirst({
        where: { entityId: ids.spe, action: "USER_PERMISSIONS_CHANGED" },
        orderBy: { createdAt: "asc" },
      });
      assert.ok(log, "activity row written");
      assert.deepEqual(JSON.parse(log.metaJson ?? "{}"), { before: "[]", after: '{"orders.act":"deny"}' });
    });

    it("keeps at least one active Admin with Act on Admin Users", async () => {
      const admin = await actor("admin");
      const lockout = await savePermissions(admin, ids.admin, [{ key: "adminUsers.act", value: "deny" }]);
      assert.equal(lockout.ok, false);
      assert.match(lockout.ok ? "" : lockout.message, /At least one active Admin must keep Act on Admin Users/);
      assert.equal((await actor("admin")).permissions, "[]", "unchanged");

      // A non-Admin holding Act on Admin Users doesn't count: the Admins must keep it.
      await prisma.user.update({ where: { id: ids.spe }, data: { permissions: '{"adminUsers.view":"allow","adminUsers.act":"allow"}' } });
      const still = await savePermissions(admin, ids.admin, [{ key: "adminUsers.act", value: "deny" }]);
      assert.equal(still.ok, false);
    });

    it("refuses a non-Admin with Act on Admin Users changing an Admin's ticks", async () => {
      await prisma.user.update({ where: { id: ids.spe }, data: { permissions: '{"adminUsers.view":"allow","adminUsers.act":"allow"}' } });
      const result = await savePermissions(await actor("spe"), ids.admin, [{ key: "settings.view", value: "deny" }]);
      assert.equal(result.ok ? null : result.status, 403);
      assert.equal((await actor("admin")).permissions, "[]", "unchanged");
    });
  },
);
