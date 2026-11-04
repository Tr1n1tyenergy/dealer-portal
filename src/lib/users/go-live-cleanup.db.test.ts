import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: need a PostgreSQL database whose name ends in `_test` (see .env.test.local, `npm run test:db`).
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(process.env.DATABASE_URL ?? "");

describe("go-live clean-up of tester accounts", { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" }, () => {
  let prisma: PrismaClient;
  let goLiveCleanup: typeof import("./go-live-cleanup").goLiveCleanup;
  const run = `glc${Date.now()}`;
  const id = { testOrg: "", realOrg: "", testStation: "", realStation: "", tester: "", tester2: "", real: "", staff: "", testConvo: "", realConvo: "" };
  const emails = () => [`tester.${run}@example.test`, `TESTER2.${run}@example.test `];
  let seq = 0;
  const order = (org: string, station: string, by: string) =>
    prisma.dealerOrder.create({
      data: { reference: `GLC-${run}-${++seq}`, odooSyncKey: `glc:${run}:${seq}`, odooQuotationNumber: `S${seq}`, status: "AWAITING_PAYMENT", dealerOrganizationId: org, stationId: station, createdById: by, lines: { create: { product: "PMS", quantityLitres: 5000 } } },
    });
  const convo = async (a: string, b: string, body: string) => {
    const c = await prisma.conversation.create({ data: { participants: { create: [{ userId: a }, { userId: b }] } } });
    await prisma.message.create({ data: { conversationId: c.id, senderId: a, body } });
    await prisma.message.create({ data: { conversationId: c.id, senderId: b, body: `re: ${body}` } });
    return c.id;
  };

  before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ goLiveCleanup } = await import("./go-live-cleanup"));
    id.testOrg = (await prisma.dealerOrganization.create({ data: { name: `Test Co ${run}`, code: `GT-${run}` } })).id;
    id.realOrg = (await prisma.dealerOrganization.create({ data: { name: `Real Co ${run}`, code: `GR-${run}` } })).id;
    id.testStation = (await prisma.station.create({ data: { name: "Test St", dealerOrganizationId: id.testOrg } })).id;
    id.realStation = (await prisma.station.create({ data: { name: "Real St", dealerOrganizationId: id.realOrg } })).id;
    const user = async (email: string, accountType: "DEALER" | "INTERNAL", org: string | null) =>
      (await prisma.user.create({ data: { firstName: "T", lastName: "U", email, department: "T", accountType, status: "ACTIVE", dealerOrganizationId: org, role: accountType === "DEALER" ? "DEALER_ADMIN" : "STANDARD_USER" } })).id;
    id.tester = await user(`tester.${run}@example.test`, "DEALER", id.testOrg);
    id.tester2 = await user(`tester2.${run}@example.test`, "DEALER", id.testOrg);
    id.real = await user(`real.${run}@example.test`, "DEALER", id.realOrg);
    id.staff = await user(`staff.${run}@example.test`, "INTERNAL", null);
    await order(id.testOrg, id.testStation, id.tester);
    await order(id.testOrg, id.testStation, id.tester2);
    await order(id.realOrg, id.realStation, id.real);
    id.testConvo = await convo(id.tester, id.staff, "test hello");
    id.realConvo = await convo(id.real, id.staff, "real hello");
  });

  after(async () => {
    await prisma.dealerOrder.deleteMany({ where: { reference: { startsWith: `GLC-${run}` } } });
    await prisma.conversation.deleteMany({ where: { id: { in: [id.testConvo, id.realConvo] } } });
    await prisma.activityLog.deleteMany({ where: { action: "GO_LIVE_CLEANUP", entityId: run } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${run}@example.test` } } });
    await prisma.dealerOrganization.deleteMany({ where: { id: { in: [id.testOrg, id.realOrg] } } });
  });

  it("a dry run reports what would go and changes nothing", async () => {
    const r = await goLiveCleanup(prisma, emails(), { confirm: false, label: run });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.plan.users.map((u) => u.email).sort(), [`tester.${run}@example.test`, `tester2.${run}@example.test`]);
    assert.equal(r.plan.orders.length, 2);
    assert.deepEqual(r.plan.orders.map((o) => o.odooQuotationNumber).sort(), ["S1", "S2"]);
    assert.equal(r.plan.conversations, 1);
    assert.equal(r.plan.messages, 2);
    assert.equal(r.deleted, false);
    assert.equal(await prisma.user.count({ where: { id: { in: [id.tester, id.tester2] } } }), 2);
    assert.equal(await prisma.dealerOrder.count({ where: { dealerOrganizationId: id.testOrg } }), 2);
  });

  it("refuses unknown emails and staff accounts, and deletes nothing", async () => {
    const unknown = await goLiveCleanup(prisma, [...emails(), `nobody.${run}@example.test`], { confirm: true, label: run });
    assert.equal(unknown.ok, false);
    const staff = await goLiveCleanup(prisma, [`staff.${run}@example.test`], { confirm: true, label: run });
    assert.equal(staff.ok, false);
    assert.equal(await prisma.user.count({ where: { email: { endsWith: `${run}@example.test` } } }), 4);
  });

  it("with confirm, removes the testers, their company's orders and their threads; keeps everyone and everything else", async () => {
    const r = await goLiveCleanup(prisma, emails(), { confirm: true, label: run });
    assert.equal(r.ok && r.deleted, true);
    assert.equal(await prisma.user.count({ where: { id: { in: [id.tester, id.tester2] } } }), 0);
    assert.equal(await prisma.dealerOrder.count({ where: { dealerOrganizationId: id.testOrg } }), 0);
    assert.equal(await prisma.dealerOrderLine.count({ where: { order: { dealerOrganizationId: id.testOrg } } }), 0);
    assert.equal(await prisma.conversation.count({ where: { id: id.testConvo } }), 0);
    // kept: the company and station (for the real client), the real dealer, their order and thread, the staff member
    assert.equal(await prisma.dealerOrganization.count({ where: { id: id.testOrg } }), 1);
    assert.equal(await prisma.station.count({ where: { id: id.testStation } }), 1);
    assert.equal(await prisma.user.count({ where: { id: { in: [id.real, id.staff] } } }), 2);
    assert.equal(await prisma.dealerOrder.count({ where: { dealerOrganizationId: id.realOrg } }), 1);
    assert.equal(await prisma.message.count({ where: { conversationId: id.realConvo } }), 2);
    const log = await prisma.activityLog.findFirst({ where: { action: "GO_LIVE_CLEANUP", entityId: run } });
    assert.ok(log);
  });
});
