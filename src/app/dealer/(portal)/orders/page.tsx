import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ShoppingCart } from "lucide-react";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * My Orders opens the order-status tracking page (same UI as /dealer/orders/[id]).
 * Dealers land on their most recent order so they can track status immediately.
 */
export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await requireDealer();
  const { submitted } = await searchParams;

  if (submitted) {
    redirect(`/dealer/orders/${submitted}`);
  }

  const latest = await prisma.dealerOrder.findFirst({
    where: { dealerOrganizationId: session.user.dealerOrganizationId! },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (latest) {
    redirect(`/dealer/orders/${latest.id}`);
  }

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
                <h1>Order Status</h1>
                <p>Track every fuel order from submission through delivery.</p>
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
        <div className="dp-orders-empty">
          <p>You have not placed any orders yet.</p>
          <Link href="/dealer/orders/new">Place your first order</Link>
        </div>
      </section>
    </div>
  );
}
