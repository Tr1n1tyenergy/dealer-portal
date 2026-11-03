import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  DEALER_ORDER_VIEWS,
  dealerOrderViewWhere,
  emptyOrdersMessage,
  parseDealerOrderView,
  toDealerOrderRow,
} from "@/lib/orders/dealer-views";
import { RecentOrders } from "@/components/dealer/recent-orders";
import { PageHead } from "@/components/layout/page-head";
import { EmptyState } from "@/components/ui/states";

/**
 * Orders: every order of the dealer, newest first, with tabs for orders needing payment,
 * orders with a PFI and orders on their way (`?view=`). `?q=` pre-fills the search.
 */
export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; view?: string | string[]; q?: string | string[] }>;
}) {
  const session = await requireDealer();
  const { submitted, view: rawView, q: rawQuery } = await searchParams;

  if (submitted) {
    redirect(`/dealer/orders/${submitted}`);
  }

  const orgId = session.user.dealerOrganizationId!;
  const view = parseDealerOrderView(rawView);
  const query = (typeof rawQuery === "string" ? rawQuery : "").trim().slice(0, 100);

  const [orders, totalOrders, stations] = await Promise.all([
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId, ...dealerOrderViewWhere(view) },
      include: { station: true, lines: true, proforma: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dealerOrder.count({ where: { dealerOrganizationId: orgId } }),
    prisma.station.findMany({
      where: { dealerOrganizationId: orgId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const tabs = DEALER_ORDER_VIEWS.map((tab) => ({
    label: tab.label,
    href: tab.href,
    active: tab.view === view,
  }));

  return (
    <div className="ui-page">
      <PageHead title="Orders" description="Every fuel order from submission to delivery." />
      {totalOrders === 0 ? (
        <EmptyState
          title="No orders yet. Place your first order and we'll prepare the quotation and PFI for you."
          action={
            <Link href="/dealer/orders/new" className="ui-btn ui-btn--primary">
              Place an order
            </Link>
          }
        />
      ) : (
        <RecentOrders
          key={`${view}:${query}`}
          initialQuery={query}
          tabs={tabs}
          emptyMessage={emptyOrdersMessage(view)}
          orders={orders.map(toDealerOrderRow)}
          stations={stations.map((s) => s.name)}
        />
      )}
    </div>
  );
}
