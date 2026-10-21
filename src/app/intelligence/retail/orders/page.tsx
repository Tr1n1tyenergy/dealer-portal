import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { can } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { likeLiteral } from "@/lib/search";
import { requireInternal } from "@/lib/session";
import { internalOrderAction } from "@/lib/orders/actions";
import { formatKes, sameAmount } from "@/lib/orders/money";
import { ORDER_STAGES, parseStage, stageOf, statusLabel, type StageKey } from "@/lib/orders/stages";
import { priceListStatus } from "@/lib/integrations/odoo/price-list-status";
import "@/app/intelligence/retail/retail-orders.css";

type SearchParams = Promise<{ stage?: string | string[]; q?: string | string[] }>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function RetailOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireInternal();
  if (!can(session.user.role, "retail.orders")) redirect("/intelligence/retail");
  const mayAct = can(session.user.role, "orders.act");
  const priceList = priceListStatus(new Date());

  const params = await searchParams;
  const stage = parseStage(first(params.stage));
  const q = String(first(params.q) ?? "").trim().slice(0, 100);

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
    <div className="ro">
      <header className="ro-head">
        <h1>Orders</h1>
        <p>Dealer fuel orders by stage. Quotations and PFIs come from Odoo; payments are confirmed and orders released to depots here.</p>
      </header>

      {priceList.message ? (
        <p className={`ro-price-alert ro-price-alert--${priceList.state}`} role={priceList.state === "expired" ? "alert" : "status"}>
          {priceList.message}
        </p>
      ) : null}

      <nav className="ro-tabs" aria-label="Order stages">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
            className="ro-tab"
            aria-current={tab.key === stage ? "page" : undefined}
          >
            {tab.label}
            <span className="ro-tab__count">{counts.get(tab.key) ?? 0}</span>
          </Link>
        ))}
      </nav>

      <form className="ro-search" action="/intelligence/retail/orders" method="get" role="search">
        <input type="hidden" name="stage" value={stage} />
        <input name="q" defaultValue={q} maxLength={100} placeholder="Search order, dealer or station" aria-label="Search orders" />
        <button type="submit">Search</button>
      </form>

      <section className="ro-panel">
        <div className="ro-table-wrap">
          <table className="ro-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Dealer</th>
                <th>Station</th>
                <th>Quotation</th>
                <th>PFI</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const payment = order.payments[0];
                return (
                  <tr key={order.id}>
                    <td className="ro-ref">{order.reference}</td>
                    <td>{order.dealerOrganization.name}</td>
                    <td>{order.station.name}</td>
                    <td>{order.odooQuotationNumber ?? "—"}</td>
                    <td>
                      {order.proforma ? (
                        <a className="ro-pfi-link" href={`/api/orders/${order.id}/pfi`} target="_blank" rel="noopener">
                          {order.proforma.number}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="ro-amount">
                      {formatKes(order.amountDue)}
                      {payment ? (
                        sameAmount(order.amountDue, payment.amount) ? (
                          <div className="ro-paid">Paid: {formatKes(payment.amount)}</div>
                        ) : (
                          <div className="ro-paid ro-paid--mismatch">Paid: {formatKes(payment.amount)} (does not match)</div>
                        )
                      ) : null}
                    </td>
                    <td>
                      {statusLabel(order.status)}
                      {order.odooSyncError && order.status === "QUOTATION_READY" ? (
                        <div className="ro-note">Last PFI attempt failed: {order.odooSyncError}</div>
                      ) : null}
                    </td>
                    <td>
                      {mayAct ? (
                        <form action={internalOrderAction} className="ro-actions">
                          <input type="hidden" name="orderId" value={order.id} />
                          {order.status === "ODOO_SYNC_FAILED" || order.status === "ODOO_SYNC_PENDING" ? (
                            <button className="ro-btn" name="action" value="retry-sync">Retry sync</button>
                          ) : null}
                          {order.status === "QUOTATION_READY" || order.status === "PFI_PENDING" || order.status === "PFI_ISSUED" ? (
                            <button className="ro-btn" name="action" value="generate-pfi">Generate PFI</button>
                          ) : null}
                          {order.status === "PAYMENT_VERIFICATION" ? (
                            <>
                              <button className="ro-btn ro-btn--go" name="action" value="confirm-payment">Confirm payment</button>
                              <button className="ro-btn ro-btn--warn" name="action" value="reject-payment">Flag exception</button>
                            </>
                          ) : null}
                          {order.status === "PAYMENT_CONFIRMED" ? (
                            <>
                              <select name="depotId" className="ro-select" defaultValue={depots[0]?.id} aria-label="Depot">
                                {depots.map((depot) => (
                                  <option key={depot.id} value={depot.id}>{depot.name}</option>
                                ))}
                              </select>
                              <button className="ro-btn ro-btn--blue" name="action" value="release">Release to depot</button>
                            </>
                          ) : null}
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 ? (
                <tr>
                  <td className="ro-empty" colSpan={8}>
                    {q ? `No orders match "${q}".` : "No orders in this stage."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
