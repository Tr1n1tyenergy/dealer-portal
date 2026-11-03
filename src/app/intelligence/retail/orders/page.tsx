import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { likeLiteral } from "@/lib/search";
import { requireInternal } from "@/lib/session";
import { formatKes, sameAmount } from "@/lib/orders/money";
import { ORDER_STAGES, parseStage, stageOf, statusLabel, type StageKey } from "@/lib/orders/stages";
import { priceListStatus } from "@/lib/integrations/odoo/price-list-status";
import { PageHead } from "@/components/layout/page-head";
import { OrderActions } from "@/components/retail/order-actions";
import { StatusChip } from "@/components/ui/status-chip";
import "@/app/intelligence/retail/retail-orders.css";

type SearchParams = Promise<{ stage?: string | string[]; q?: string | string[] }>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Retry sync runs the same Odoo calls as placing an order.
export const maxDuration = 60;

export default async function RetailOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");
  const mayAct = canUser(session.user, "orders", "act");
  const priceList = priceListStatus(new Date());

  const params = await searchParams;
  const q = String(first(params.q) ?? "").trim().slice(0, 100);
  const stage = parseStage(first(params.stage), q !== "");

  const term = likeLiteral(q);
  const searchWhere: Prisma.DealerOrderWhereInput = q
    ? {
        OR: [
          { reference: { contains: term, mode: "insensitive" } },
          { dealerOrganization: { name: { contains: term, mode: "insensitive" } } },
          { station: { name: { contains: term, mode: "insensitive" } } },
        ],
      }
    : {};
  const stageStatuses = stage === "all" ? null : ORDER_STAGES.find((s) => s.key === stage)!.statuses;

  const [orders, grouped, depots] = await Promise.all([
    prisma.dealerOrder.findMany({
      where: stageStatuses ? { ...searchWhere, status: { in: stageStatuses } } : searchWhere,
      include: {
        dealerOrganization: true,
        station: true,
        proforma: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dealerOrder.groupBy({ by: ["status"], where: searchWhere, _count: { _all: true } }),
    prisma.depot.findMany({ orderBy: { name: "asc" } }),
  ]);

  const counts = new Map<StageKey | "all", number>();
  for (const row of grouped) {
    const key = stageOf(row.status);
    counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    counts.set("all", (counts.get("all") ?? 0) + row._count._all);
  }
  const tabHref = (key: StageKey | "all") => {
    const query = new URLSearchParams({ stage: key });
    if (q) query.set("q", q);
    return `/intelligence/retail/orders?${query}`;
  };
  const tabs: { key: StageKey | "all"; label: string }[] = [...ORDER_STAGES, { key: "all", label: "All" }];

  return (
    <div className="ui-page so">
      <PageHead
        title="Orders"
        description="Dealer fuel orders by stage: issue the PFI, confirm payments and release orders to the depot."
      />
      {priceList.message ? (
        <p className={`so-price so-price--${priceList.state}`} role={priceList.state === "expired" ? "alert" : "status"}>
          {priceList.message}
        </p>
      ) : null}
      <nav className="ui-tabs so-tabs" aria-label="Order stages">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tabHref(tab.key)} className="ui-navlink" aria-current={tab.key === stage ? "page" : undefined}>
            {tab.label}
            <span className="so-tabs__count">{counts.get(tab.key) ?? 0}</span>
          </Link>
        ))}
      </nav>
      <form className="so-search" action="/intelligence/retail/orders" method="get" role="search">
        <input className="ui-input" name="q" defaultValue={q} maxLength={100} placeholder="Search order, dealer or station" aria-label="Search orders" />
        <button type="submit" className="ui-btn ui-btn--secondary">
          Search
        </button>
      </form>
      <div className="so-table-wrap">
        <table className="so-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Dealer</th>
              <th>Station</th>
              <th>Quotation</th>
              <th>PFI</th>
              <th>Amount</th>
              <th>Status</th>
              {mayAct ? <th>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const payment = order.payments[0];
              return (
                <tr key={order.id}>
                  <td className="so-ref" data-label="Order">
                    {order.reference}
                  </td>
                  <td data-label="Dealer">{order.dealerOrganization.name}</td>
                  <td data-label="Station">{order.station.name}</td>
                  <td className="so-nowrap" data-label="Quotation">
                    {order.odooQuotationNumber ?? "—"}
                  </td>
                  <td className="so-nowrap" data-label="PFI">
                    {order.proforma ? (
                      <a className="ui-navlink" href={`/api/orders/${order.id}/pfi`} target="_blank" rel="noopener">
                        {order.proforma.number}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="so-amount" data-label="Amount">
                    {formatKes(order.amountDue)}
                    {payment ? (
                      sameAmount(order.amountDue, payment.amount) ? (
                        <div className="so-paid">Paid: {formatKes(payment.amount)}</div>
                      ) : (
                        <div className="so-paid so-paid--mismatch">Paid: {formatKes(payment.amount)} (does not match)</div>
                      )
                    ) : null}
                  </td>
                  <td className="so-status" data-label="Status">
                    <StatusChip status={order.status} label={statusLabel(order.status)} />
                    {order.odooSyncError && order.status === "QUOTATION_READY" ? (
                      <div className="so-note">Last PFI attempt failed: {order.odooSyncError}</div>
                    ) : null}
                  </td>
                  {mayAct ? (
                    <td className="so-act">
                      <OrderActions orderId={order.id} status={order.status} depots={depots} mayAct={mayAct} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 ? <p className="so-empty">{q ? `No orders match "${q}".` : "No orders in this stage."}</p> : null}
      </div>
    </div>
  );
}
