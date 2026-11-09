import { redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  dealerOrderViewWhere,
  parseDealerOrderView,
  toDealerOrderRow,
} from "@/lib/orders/dealer-views";
import { OrdersManagement } from "@/components/dealer/orders-management";
import { DealerHeroActions } from "@/components/dealer/dealer-hero-actions";
import { dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import "../../dealer-orders.css";

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

  const [orders, totalOrders] = await Promise.all([
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId, ...dealerOrderViewWhere(view) },
      include: { station: true, lines: true, proforma: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dealerOrder.count({ where: { dealerOrganizationId: orgId } }),
  ]);

  return (
    <div className="do">
      <section className="do__hero" style={dealerHeroPhotoStyle}>
        <div className="do__hero-veil" aria-hidden />
        <div className="do__hero-inner">
          <div className="do__eyebrow">
            <span className="do__eyebrow-line" aria-hidden />
            <span className="do__eyebrow-text">Orders</span>
          </div>
          <h1>Your Orders</h1>
          <p>Every fuel order from submission to delivery.</p>
          <DealerHeroActions />
        </div>
      </section>

      <OrdersManagement
        key={`${view}:${query}`}
        view={view}
        orders={orders.map(toDealerOrderRow)}
        accountEmpty={totalOrders === 0}
        initialQuery={query}
      />
    </div>
  );
}
