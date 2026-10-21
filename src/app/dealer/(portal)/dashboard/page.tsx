import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileText,
  LayoutList,
  MapPin,
  Package,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { parseProductsJson } from "@/lib/dealers/registry";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDealerOrderRow } from "@/lib/orders/dealer-views";
import { RecentOrders } from "@/components/dealer/recent-orders";
import { nairobiParts } from "@/lib/time/nairobi";

function greeting() {
  const { hour } = nairobiParts();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DealerDashboardPage() {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const [org, orders, stations] = await Promise.all([
    prisma.dealerOrganization.findUnique({ where: { id: orgId } }),
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId },
      include: { station: true, lines: true, proforma: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.station.findMany({
      where: { dealerOrganizationId: orgId },
      orderBy: { name: "asc" },
    }),
  ]);

  const orgName = org?.name ?? session.user.firstName ?? "Dealer";
  const count = (statuses: string[]) => orders.filter((o) => statuses.includes(o.status)).length;

  const cards = [
    {
      label: "Open Orders",
      value: orders.filter((o) => !["CLOSED", "CANCELLED", "REJECTED", "DELIVERED"].includes(o.status)).length,
      href: "/dealer/orders",
      link: "View all orders",
      icon: Package,
    },
    {
      label: "Awaiting PFI",
      value: count(["QUOTATION_READY", "PFI_PENDING", "ODOO_SYNC_PENDING", "SUBMITTED", "QUOTATION_CREATING"]),
      href: "/dealer/orders",
      link: "View quotations",
      icon: FileText,
    },
    {
      label: "Awaiting Payment",
      value: count(["PFI_ISSUED", "AWAITING_PAYMENT", "PAYMENT_EXCEPTION"]),
      href: "/dealer/orders?view=payment",
      link: "View payments",
      icon: Wallet,
    },
    {
      label: "In Transit",
      value: count(["DISPATCHED", "IN_TRANSIT"]),
      href: "/dealer/orders?view=deliveries",
      link: "Track deliveries",
      icon: Truck,
    },
    {
      label: "Delivered",
      value: count(["DELIVERED", "CLOSED"]),
      href: "/dealer/orders?view=deliveries",
      link: "View delivered",
      icon: LayoutList,
    },
  ];

  const recentRows = orders.slice(0, 8).map(toDealerOrderRow);

  return (
    <div className="dp-dash">
      <section
        className="dp-hero"
        style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
      >
        <div className="dp-hero__veil" />
        <div className="dp-hero__inner">
          <div className="dp-hero__copy">
            <div className="dp-hero__kicker">Dealer Portal</div>
            <h1>
              {greeting()}, <span>{orgName}</span>
            </h1>
            <p>
              Place fuel orders, follow PFIs, make payments and track deliveries for your
              stations, all in one place.
            </p>
          </div>

          <div className="dp-hero__metrics">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="dp-metric">
                  <div className="dp-metric__icon">
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                  <strong>{card.value}</strong>
                  <div className="dp-metric__label">{card.label}</div>
                  <Link href={card.href}>{card.link} →</Link>
                </article>
              );
            })}

            <Link href="/dealer/orders/new" className="dp-order-cta">
              <span className="dp-order-cta__plus">
                <Plus size={22} strokeWidth={2.5} />
              </span>
              <span className="dp-order-cta__text">Place Fuel Order</span>
              <span className="dp-order-cta__go">
                <ArrowRight size={18} strokeWidth={2.4} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="dp-body">
        <RecentOrders
          orders={recentRows}
          stations={stations.map((s) => s.name)}
        />

        <article className="dp-card dp-quick">
          <div className="dp-card__head">
            <div className="dp-card__title is-gold">
              <Zap size={18} strokeWidth={1.8} />
              Quick Actions
            </div>
          </div>
          <div className="dp-actions">
            <Link href="/dealer/orders/new" className="dp-action">
              <span className="dp-action__icon is-blue">
                <ShoppingCart size={16} />
              </span>
              <span>
                <strong>Place New Order</strong>
                <em>Request PMS or AGO for a station</em>
              </span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/dealer/orders?view=documents" className="dp-action">
              <span className="dp-action__icon is-cyan">
                <FileText size={16} />
              </span>
              <span>
                <strong>View PFIs</strong>
                <em>Open proforma invoices & docs</em>
              </span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/dealer/orders?view=payment" className="dp-action">
              <span className="dp-action__icon is-gold">
                <CreditCard size={16} />
              </span>
              <span>
                <strong>Make a Payment</strong>
                <em>Submit payment against a PFI</em>
              </span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/dealer/orders?view=deliveries" className="dp-action">
              <span className="dp-action__icon is-green">
                <Truck size={16} />
              </span>
              <span>
                <strong>Track Deliveries</strong>
                <em>Follow orders in transit</em>
              </span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </article>

        <article className="dp-card dp-stations-card" id="stations">
          <div className="dp-card__head">
            <div className="dp-card__title">
              <MapPin size={18} strokeWidth={1.8} />
              Stations
            </div>
          </div>
          <ul className="dp-stations">
            {stations.map((station) => {
              const products = parseProductsJson(station.products);
              return (
              <li key={station.id}>
                <div>
                  <strong>{station.name}</strong>
                  <span className="dp-stations__status">
                    <i /> {products.join(" · ")}
                  </span>
                </div>
              </li>
              );
            })}
            {stations.length === 0 ? (
              <li className="dp-empty">No stations linked to this account.</li>
            ) : null}
          </ul>
        </article>
      </section>
    </div>
  );
}
