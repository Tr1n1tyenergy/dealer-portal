import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "report search",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let filter: typeof import("./report-filter");
    const run = `r${Date.now()}`;
    const users: Record<"owner" | "other" | "admin", string> = { owner: "", other: "", admin: "" };
    let reportId = "";

    async function titles(viewer: "owner" | "other" | "admin", q: string | null) {
      const role = viewer === "admin" ? "SUPER_ADMIN" : "STANDARD_USER";
      const where = filter.reportListWhere({ viewer: { id: users[viewer], role }, category: null, q, from: null, to: null });
      const rows = await prisma.report.findMany({ where });
      return rows.filter((row) => row.title.includes(run)).map((row) => row.id);
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      filter = await import("./report-filter");
      for (const [key, role] of [["owner", "STANDARD_USER"], ["other", "STANDARD_USER"], ["admin", "SUPER_ADMIN"]] as const) {
        users[key] = (
          await prisma.user.create({
            data: { firstName: "T", lastName: key, email: `${key}.${run}@example.test`, department: "T", role, status: "ACTIVE" },
          })
        ).id;
      }
      reportId = (
        await prisma.report.create({
          data: { title: `Fuel Retail Summary ${run}`, description: "Weekly Station Volumes", userId: users.owner },
        })
      ).id;
    });

    after(async () => {
      await prisma.report.deleteMany({ where: { userId: { in: Object.values(users) } } });
      await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
      await prisma.$disconnect();
    });

    it("ignores capital letters in the title and description", async () => {
      for (const q of ["fuel", "FUEL", "retail", "station volumes"]) {
        assert.deepEqual(await titles("owner", q), [reportId], `search "${q}"`);
      }
    });

    it("matches % and _ literally instead of as wildcards", async () => {
      assert.deepEqual(await titles("owner", "%"), []);
      assert.deepEqual(await titles("owner", "_"), []);
    });

    it("treats a blank search as no filter", async () => {
      assert.deepEqual(await titles("owner", "   "), [reportId]);
      assert.deepEqual(await titles("owner", null), [reportId]);
    });

    it("keeps other users' reports hidden from non-Admins", async () => {
      assert.deepEqual(await titles("other", "fuel"), []);
      assert.deepEqual(await titles("admin", "fuel"), [reportId]);
    });
  },
);
