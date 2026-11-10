import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: need a PostgreSQL database whose name ends in `_test` (see .env.test.local, `npm run test:db`).
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(process.env.DATABASE_URL ?? "");

describe("access requests (Ask an Admin)", { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" }, () => {
  let prisma: PrismaClient;
  let svc: typeof import("./access-requests");
  const run = `ar${Date.now()}`;
  const ids = { admin: "", staff: "", other: "", dealer: "" };
  const user = (k: keyof typeof ids) => prisma.user.findUniqueOrThrow({ where: { id: ids[k] } });

  before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    svc = await import("./access-requests");
    for (const [k, role, accountType] of [
      ["admin", "SUPER_ADMIN", "INTERNAL"],
      ["staff", "STANDARD_USER", "INTERNAL"],
      ["other", "STANDARD_USER", "INTERNAL"],
      ["dealer", "DEALER_ADMIN", "DEALER"],
    ] as const) {
      ids[k] = (await prisma.user.create({ data: { firstName: "T", lastName: k, email: `${k}.${run}@example.test`, department: "T", role, accountType, status: "ACTIVE" } })).id;
    }
  });

  after(async () => {
    await prisma.accessRequest.deleteMany({ where: { requesterId: { in: Object.values(ids) } } });
    await prisma.activityLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("creates a PENDING request and refuses a second while one is pending", async () => {
    const first = await svc.createAccessRequest(await user("staff"), ["orders", "analytics"], "For the sales review");
    assert.ok(first.ok);
    const row = await prisma.accessRequest.findFirstOrThrow({ where: { requesterId: ids.staff } });
    assert.equal(row.status, "PENDING");
    assert.deepEqual(JSON.parse(row.modules), ["orders", "analytics"]);
    const second = await svc.createAccessRequest(await user("staff"), ["messaging"]);
    assert.equal(second.ok ? null : second.status, 409);
  });

  it("refuses unknown or no modules, and non-staff accounts", async () => {
    const unknown = await svc.createAccessRequest(await user("other"), ["orders", "payroll"]);
    assert.equal(unknown.ok ? null : unknown.status, 400);
    const none = await svc.createAccessRequest(await user("other"), []);
    assert.equal(none.ok ? null : none.status, 400);
    const dealer = await svc.createAccessRequest(await user("dealer"), ["orders"]);
    assert.equal(dealer.ok ? null : dealer.status, 403);
  });

  it("only someone with Act on Admin users may decide", async () => {
    const req = await prisma.accessRequest.findFirstOrThrow({ where: { requesterId: ids.staff } });
    const r = await svc.decideAccessRequest(await user("other"), req.id, "GRANTED");
    assert.equal(r.ok ? null : r.status, 403);
  });

  it("grant sets GRANTED with who and when; a decided request cannot be decided again", async () => {
    const req = await prisma.accessRequest.findFirstOrThrow({ where: { requesterId: ids.staff } });
    assert.ok((await svc.decideAccessRequest(await user("admin"), req.id, "GRANTED")).ok);
    const row = await prisma.accessRequest.findUniqueOrThrow({ where: { id: req.id } });
    assert.equal(row.status, "GRANTED");
    assert.equal(row.decidedById, ids.admin);
    assert.ok(row.decidedAt);
    const again = await svc.decideAccessRequest(await user("admin"), req.id, "DECLINED");
    assert.equal(again.ok ? null : again.status, 409);
  });

  it("decline sets DECLINED, and the person may then ask again", async () => {
    assert.ok((await svc.createAccessRequest(await user("other"), ["messaging"])).ok);
    const req = await prisma.accessRequest.findFirstOrThrow({ where: { requesterId: ids.other } });
    assert.ok((await svc.decideAccessRequest(await user("admin"), req.id, "DECLINED")).ok);
    assert.equal((await prisma.accessRequest.findUniqueOrThrow({ where: { id: req.id } })).status, "DECLINED");
    assert.ok((await svc.createAccessRequest(await user("other"), ["messaging"])).ok);
  });
});
