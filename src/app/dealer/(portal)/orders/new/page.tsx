import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlaceOrderForm } from "@/components/dealer/place-order-form";
import { dealerOrderingNotice } from "@/lib/security/launch-mode";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";

// Placing an order makes ~10 Odoo calls (each capped at 8 s); give the request room to finish.
export const maxDuration = 60;

export default async function NewOrderPage() {
  const session = await requireDealer();
  const stations = await prisma.station.findMany({
    where: { dealerOrganizationId: session.user.dealerOrganizationId! },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  const priced = stations.map(({ id, name, code }) => {
    const pms = code ? epraUnitPriceForStation(code, "PMS") : null;
    const ago = code ? epraUnitPriceForStation(code, "AGO") : null;
    return { id, name, prices: pms != null && ago != null ? { pms, ago } : null };
  });

  return <PlaceOrderForm stations={priced} orderingNotice={dealerOrderingNotice()} />;
}
