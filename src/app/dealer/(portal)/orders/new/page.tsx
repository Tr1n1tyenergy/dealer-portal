import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlaceOrderForm } from "@/components/dealer/place-order-form";

export default async function NewOrderPage() {
  const session = await requireDealer();
  const stations = await prisma.station.findMany({
    where: { dealerOrganizationId: session.user.dealerOrganizationId! },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <PlaceOrderForm stations={stations} />;
}
