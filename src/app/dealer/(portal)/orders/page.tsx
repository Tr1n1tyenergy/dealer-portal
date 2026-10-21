import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ShoppingCart } from "lucide-react";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  DEALER_ORDER_VIEWS,
  dealerOrderViewWhere,
  parseDealerOrderView,
  toDealerOrderRow,
} from "@/lib/orders/dealer-views";
import { RecentOrders } from "@/components/dealer/recent-orders";

/**
 * My Orders: every order of the dealer, newest first, with tabs for orders needing payment,
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
    <div className="dp-dash">
      <section
        className="dp-hero dp-hero--compact"
        style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
      >
        <div className="dp-hero__veil" />
        <div className="dp-hero__inner">
          <nav className="dp-po-crumb" aria-label="Breadcrumb">
            <Link href="/dealer/dashboard">Home</Link>
            <span className="sep">/</span>
            <span className="is-current">My Orders</span>
          </nav>
          <div className="dp-po-hero__row">
            <div className="dp-po-hero__title">
              <span className="dp-po-hero__badge">
                <Package size={22} strokeWidth={2} />
              </span>
              <div className="dp-hero__copy">
                <div className="dp-hero__kicker">My Orders</div>
                <h1>Your Orders</h1>
                <p>Every fuel order from submission through delivery.</p>
              </div>
            </div>
            <Link href="/dealer/orders/new" className="dp-po-help">
              <ShoppingCart size={16} />
              Place new order
            </Link>
          </div>
        </div>
      </section>

      <section className="dp-body dp-orders-page">
        {totalOrders === 0 ? (
          <div className="dp-orders-empty">
            <p>You have not placed any orders yet.</p>
            <Link href="/dealer/orders/new">Place your first order</Link>
          </div>
        ) : (
          <RecentOrders
            key={`${view}:${query}`}
            title="My Orders"
            subtitle="Search, filter and open any of your orders."
            showViewAll={false}
            initialQuery={query}
            tabs={tabs}
            orders={orders.map(toDealerOrderRow)}
            stations={stations.map((s) => s.name)}
          />
        )}
      </section>
    </div>
  );
}
