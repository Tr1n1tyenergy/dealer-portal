import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

/** Tomorrow in Kenya (UTC+3), so the delivery-date rule never goes stale. */
const tomorrow = () => new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe(
  "PFI issued by the portal",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    const run = `p${Date.now()}`;
    let organizationId = "";
    let pricedStationId = "";
    let unpricedStationId = "";
    let dealerId = "";
    let staffId = "";
    let sequence = 0;

    async function quotedOrder(stationId: string, lines: { product: "PMS" | "AGO"; quantityLitres: number; unitPriceExVat?: string | null }[]) {
      sequence += 1;
      return prisma.dealerOrder.create({
        data: {
          reference: `PFI-${run}-${sequence}`,
          odooSyncKey: `pfi:${run}:${sequence}`,
          odooQuotationId: `mock-quot-${run}-${sequence}`,
          odooQuotationNumber: `S9${String(sequence).padStart(4, "0")}-${run}`,
          status: "QUOTATION_READY",
          dealerOrganizationId: organizationId,
          stationId,
          createdById: dealerId,
          lines: { create: lines.map((l) => ({ product: l.product, quantityLitres: l.quantityLitres, unitPriceExVat: l.unitPriceExVat ?? null })) },
        },
      });
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      organizationId = (await prisma.dealerOrganization.create({ data: { name: `PFI Dealer ${run}`, code: `PFI-${run}` } })).id;
      // "kitale" loads at KPC Eldoret: PMS 226.51 − 3 = 223.51 before VAT.
      const existingKitale = await prisma.station.findUnique({ where: { code: "kitale" } });
      pricedStationId = existingKitale
        ? existingKitale.id
        : (await prisma.station.create({ data: { code: "kitale", name: "Kitale", dealerOrganizationId: organizationId } })).id;
      if (existingKitale) await prisma.station.update({ where: { id: existingKitale.id }, data: { dealerOrganizationId: organizationId } });
      unpricedStationId = (await prisma.station.create({ data: { name: "No Price Station", dealerOrganizationId: organizationId } })).id;
      dealerId = (
        await prisma.user.create({
          data: { firstName: "D", lastName: "Dealer", email: `dealer.${run}@example.test`, department: "Dealer", role: "DEALER_ADMIN", accountType: "DEALER", status: "ACTIVE", dealerOrganizationId: organizationId },
        })
      ).id;
      staffId = (
        await prisma.user.create({
          data: { firstName: "S", lastName: "Exec", email: `spe.${run}@example.test`, department: "Sales", role: "SALES_PERSON_EXECUTIVE", status: "ACTIVE" },
        })
      ).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.activityLog.deleteMany({ where: { actorId: { in: [dealerId, staffId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [dealerId, staffId] } } });
      await prisma.station.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("a submitted order gets its PFI automatically", async () => {
      const submitted = await service.submitDealerOrder({
        actorId: dealerId,
        dealerOrganizationId: organizationId,
        stationId: pricedStationId,
        requestedDeliveryDate: tomorrow(),
        dealerReference: `PO-${run}`,
        lines: [{ product: "PMS", quantityLitres: 5000 }],
        submissionKey: `${run}-auto`,
      });
      const order = await prisma.dealerOrder.findUniqueOrThrow({ where: { id: submitted.id }, include: { proforma: true, lines: true } });
      assert.equal(order.status, "AWAITING_PAYMENT");
      assert.ok(order.proforma, "PFI should exist");
      assert.equal(order.proforma.number, order.odooQuotationNumber);
      assert.equal(order.proforma.subtotal, "1117550.00");
      assert.equal(order.proforma.vatAmount, "89404.00");
      assert.equal(order.proforma.amount, "1206954.00");
      assert.equal(order.proforma.vatRate, "0.08");
      assert.equal(order.proforma.preparedByName, "EVAN OTIATO");
      assert.equal(order.proforma.approvedByName, "EVAN OTIATO");
      assert.equal(order.amountDue, "1206954.00");
      assert.ok(order.quotedAt, "quotedAt should be set");
      assert.equal(order.lines[0].unitPriceExVat, "223.51");
    });

    it("a line without a stored price is frozen at today's price", async () => {
      const order = await quotedOrder(pricedStationId, [{ product: "PMS", quantityLitres: 1000, unitPriceExVat: null }]);
      await service.generatePfi(order.id, staffId);
      const line = await prisma.dealerOrderLine.findFirstOrThrow({ where: { orderId: order.id } });
      assert.equal(line.unitPriceExVat, "223.51");
    });

    it("a PFI number already used by another order is refused with a note, not left stuck", async () => {
      const first = await quotedOrder(pricedStationId, [{ product: "PMS", quantityLitres: 6000 }]);
      const second = await quotedOrder(pricedStationId, [{ product: "PMS", quantityLitres: 4000 }]);
      await prisma.dealerOrder.update({ where: { id: second.id }, data: { odooQuotationNumber: first.odooQuotationNumber } });
      await service.generatePfi(first.id, staffId);

      const result = await service.generatePfi(second.id, staffId);

      assert.equal(result.status, "QUOTATION_READY");
      assert.match(result.odooSyncError ?? "", /already used by another order/);
      assert.equal(await prisma.proFormaInvoice.count({ where: { orderId: second.id } }), 0);
    });

    it("a station with no price stays at QUOTATION_READY with the note", async () => {
      const order = await quotedOrder(unpricedStationId, [{ product: "PMS", quantityLitres: 1000 }]);
      await service.generatePfi(order.id, null);
      const saved = await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id }, include: { proforma: true } });
      assert.equal(saved.status, "QUOTATION_READY");
      assert.equal(saved.odooSyncError, service.PFI_NO_PRICE_NOTE);
      assert.equal(saved.proforma, null);
    });

    it("the automatic PFI and a staff retry together leave one PFI", async () => {
      const order = await quotedOrder(pricedStationId, [{ product: "AGO", quantityLitres: 2000 }]);
      await Promise.allSettled([service.generatePfi(order.id, null), service.generatePfi(order.id, staffId)]);
      assert.equal(await prisma.proFormaInvoice.count({ where: { orderId: order.id } }), 1);
      const saved = await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(saved.status, "AWAITING_PAYMENT");
    });
  },
);
