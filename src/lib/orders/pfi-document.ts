import { prisma } from "@/lib/prisma";
import { PFI_SIGNATORIES } from "@/lib/company/pfi-settings";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import { fulfillmentForStation } from "@/lib/integrations/odoo/quotation-contract";
import { pfiTotals, PFI_VAT_RATE, type PfiLineInput } from "@/lib/orders/pfi-totals";
import type { PfiDocument } from "@/lib/orders/pfi-pdf";

/**
 * Gather what the PFI PDF prints, from the frozen PFI and its order. A PFI issued before prices
 * were frozen is worked out from today's price list for display only; nothing is written.
 */
export async function loadPfiDocument(
  orderId: string,
): Promise<{ document: PfiDocument; dealerOrganizationId: string } | null> {
  const order = await prisma.dealerOrder.findUnique({
    where: { id: orderId },
    include: { proforma: true, lines: true, station: true, dealerOrganization: true },
  });
  if (!order?.proforma) return null;
  const pfi = order.proforma;
  const stationCode = order.station.code ?? null;

  const lines: PfiLineInput[] = order.lines
    .filter((line) => line.product === "PMS" || line.product === "AGO")
    .map((line) => {
      const product = line.product as "PMS" | "AGO";
      const today = stationCode ? epraUnitPriceForStation(stationCode, product) : null;
      return {
        product,
        quantityLitres: line.quantityLitres,
        unitPriceExVat: line.unitPriceExVat ?? (today == null ? "0.00" : today.toFixed(2)),
      };
    });
  const totals = pfiTotals(lines, pfi.vatRate ?? PFI_VAT_RATE);

  const partnerId = order.station.odooPartnerId ?? order.dealerOrganization.odooPartnerId;
  return {
    dealerOrganizationId: order.dealerOrganizationId,
    document: {
      number: pfi.number,
      soDate: order.quotedAt ?? pfi.issuedAt,
      issuedAt: pfi.issuedAt,
      customerName: order.dealerOrganization.name,
      customerId: partnerId != null ? String(partnerId) : order.dealerOrganization.code,
      addressLines: [order.station.name, "Kenya"],
      sourceLocation: (stationCode && fulfillmentForStation(stationCode)?.sourceLocationName) || "—",
      // The frozen figures win; lines are recomputed only to list them.
      totals: pfi.subtotal && pfi.vatAmount
        ? { ...totals, subtotal: pfi.subtotal, vat: pfi.vatAmount, total: pfi.amount }
        : totals,
      preparedBy: pfi.preparedByName ?? PFI_SIGNATORIES.preparedBy,
      approvedBy: pfi.approvedByName ?? PFI_SIGNATORIES.approvedBy,
    },
  };
}
