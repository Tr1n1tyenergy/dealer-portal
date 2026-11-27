import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlaceOrderForm } from "@/components/dealer/place-order-form";
import { dealerOrderingNotice } from "@/lib/security/launch-mode";
import { loadDealerUnitPriceMap } from "@/lib/integrations/odoo/dealer-prices";
import { getOdooClient } from "@/lib/integrations/odoo/client";

// Placing an order makes ~10 Odoo calls (each capped at 8 s); give the request room to finish.
export const maxDuration = 60;

export default async function NewOrderPage() {
  const session = await requireDealer();
  const [stations, priceMap, driverLoad] = await Promise.all([
    prisma.station.findMany({
      where: { dealerOrganizationId: session.user.dealerOrganizationId! },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    loadDealerUnitPriceMap(),
    getOdooClient()
      .listDriverRecords()
      .then((drivers) => ({ drivers, driversError: null as string | null }))
      .catch(() => ({
        drivers: [],
        driversError: "Driver records could not be loaded. Try again.",
      })),
  ]);

  return (
    <PlaceOrderForm
      stations={stations.map((s) => {
        const prices = s.code ? priceMap.get(s.code) : undefined;
        return {
          id: s.id,
          name: s.name,
          code: s.code,
          pmsPriceExVat: prices?.pms ?? null,
          agoPriceExVat: prices?.ago ?? null,
        };
      })}
      orderingNotice={dealerOrderingNotice()}
      drivers={driverLoad.drivers}
      driversError={driverLoad.driversError}
    />
  );
}
