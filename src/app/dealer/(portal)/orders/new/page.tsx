import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlaceOrderForm } from "@/components/dealer/place-order-form";
import { dealerOrderingNotice } from "@/lib/security/launch-mode";

// Placing an order makes ~10 Odoo calls (each capped at 8 s); give the request room to finish.
export const maxDuration = 60;

export default async function NewOrderPage() {
  const session = await requireDealer();
  const stations = await prisma.station.findMany({
    where: { dealerOrganizationId: session.user.dealerOrganizationId! },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <PlaceOrderForm stations={stations} orderingNotice={dealerOrderingNotice()} />;
}
