import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "loading a PFI for the PDF",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    let loader: typeof import("./pfi-document");
    const run = `d${Date.now()}`;
    let organizationId = "";
    let stationId = "";
    let dealerId = "";
    let sequence = 0;

    async function quotedOrder(unitPriceExVat: string | null) {
      sequence += 1;
      return prisma.dealerOrder.create({
        data: {
          reference: `DOC-${run}-${sequence}`,
          odooSyncKey: `doc:${run}:${sequence}`,
          odooQuotationId: `mock-quot-${run}-${sequence}`,
          odooQuotationNumber: `S8${sequence}-${run}`,
          status: "QUOTATION_READY",
          dealerOrganizationId: organizationId,
          stationId,
          createdById: dealerId,
          lines: { create: [{ product: "PMS", quantityLitres: 1000, unitPriceExVat }] },
        },
      });
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      loader = await import("./pfi-document");
      organizationId = (await prisma.dealerOrganization.create({ data: { name: `Doc Dealer ${run}`, code: `DOC-${run}` } })).id;
      const existingKitale = await prisma.station.findUnique({ where: { code: "kitale" } });
      stationId = existingKitale
        ? (await prisma.station.update({ where: { id: existingKitale.id }, data: { dealerOrganizationId: organizationId } })).id
        : (await prisma.station.create({ data: { code: "kitale", name: "Kitale", dealerOrganizationId: organizationId } })).id;
      dealerId = (
        await prisma.user.create({
          data: { firstName: "D", lastName: "Doc", email: `doc.${run}@example.test`, department: "Dealer", role: "DEALER_ADMIN", accountType: "DEALER", status: "ACTIVE", dealerOrganizationId: organizationId },
        })
      ).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.activityLog.deleteMany({ where: { actorId: dealerId } });
      await prisma.user.delete({ where: { id: dealerId } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("maps an issued PFI to the PDF data", async () => {
      const order = await quotedOrder("223.51");
      await service.generatePfi(order.id, null);
      const loaded = await loader.loadPfiDocument(order.id);
      assert.ok(loaded);
      assert.equal(loaded.dealerOrganizationId, organizationId);
      assert.equal(loaded.document.number, `S81-${run}`);
      assert.equal(loaded.document.customerName, `Doc Dealer ${run}`);
      assert.equal(loaded.document.customerId, `DOC-${run}`);
      assert.deepEqual(loaded.document.addressLines, ["Kitale", "Kenya"]);
      assert.equal(loaded.document.sourceLocation, "KPC-ELDORET/Stock");
      assert.deepEqual([loaded.document.totals.subtotal, loaded.document.totals.vat, loaded.document.totals.total], ["223510.00", "17880.80", "241390.80"]);
      assert.equal(loaded.document.preparedBy, "EVAN OTIATO");
    });

    it("opens a PFI issued before this change without writing anything", async () => {
      const order = await quotedOrder(null);
      await prisma.proFormaInvoice.create({ data: { orderId: order.id, number: `OLD-${run}`, amount: "223510.00" } });
      const before = await prisma.dealerOrderLine.findFirstOrThrow({ where: { orderId: order.id } });

      const loaded = await loader.loadPfiDocument(order.id);

      assert.ok(loaded);
      assert.equal(loaded.document.totals.total, "241390.80");
      assert.equal(loaded.document.approvedBy, "EVAN OTIATO");
      const afterLine = await prisma.dealerOrderLine.findFirstOrThrow({ where: { orderId: order.id } });
      assert.equal(afterLine.unitPriceExVat, before.unitPriceExVat);
      const pfi = await prisma.proFormaInvoice.findUniqueOrThrow({ where: { orderId: order.id } });
      assert.equal(pfi.subtotal, null);
    });

    it("returns null for an order without a PFI", async () => {
      const order = await quotedOrder("223.51");
      assert.equal(await loader.loadPfiDocument(order.id), null);
    });
  },
);
