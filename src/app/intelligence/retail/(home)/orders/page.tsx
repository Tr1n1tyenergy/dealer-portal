import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Fuel,
  MapPin,
  Truck,
  Warehouse,
} from "lucide-react";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { likeLiteral } from "@/lib/search";
import { requireInternal } from "@/lib/session";
import { formatKes } from "@/lib/orders/money";
import { ORDER_STAGES, stageOf, statusLabel, type StageKey } from "@/lib/orders/stages";
import { staffOrderFilters, type StaffOrderFilters } from "@/lib/orders/staff-views";
import { dealerTrackerSteps } from "@/lib/orders/state-machine";
import { priceListStatus } from "@/lib/integrations/odoo/price-list-status";
import "@/app/intelligence/retail/staff-orders.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 10;

const KPI_ICONS: Partial<Record<StageKey, typeof Banknote>> = {
  "awaiting-payment": Banknote,
  "checking-payment": Eye,
  "payment-confirmed": CheckCircle2,
  depot: Warehouse,
  transit: Truck,
  complete: CheckCircle2,
};

function query(filters: StaffOrderFilters, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams();
  const base: Record<string, string | null> = {
    stage: filters.stage === "all" ? null : filters.stage,
    q: filters.q || null,
    period: filters.period === "all" ? null : filters.period,
    from: filters.from,
    to: filters.to,
    station: filters.stationId,
    dealer: filters.dealerId,
    page: filters.page > 1 ? String(filters.page) : null,
    sel: filters.sel,
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) if (value) params.set(key, value);
  const text = params.toString();
  return `/intelligence/retail/orders${text ? `?${text}` : ""}`;
}

function whenLabel(at: Date): string {
  return at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
}

export const maxDuration = 60;

export default async function RetailOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");
  const priceList = priceListStatus(new Date());

  const filters = staffOrderFilters(await searchParams);
  const term = likeLiteral(filters.q);
  const baseWhere: Prisma.DealerOrderWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { reference: { contains: term, mode: "insensitive" } },
            { proforma: { number: { contains: term, mode: "insensitive" } } },
            { dealerOrganization: { name: { contains: term, mode: "insensitive" } } },
            { station: { name: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filters.stationId ? { stationId: filters.stationId } : {}),
    ...(filters.dealerId ? { dealerOrganizationId: filters.dealerId } : {}),
    ...(filters.range ? { createdAt: { gte: filters.range.gte, lt: filters.range.lt } } : {}),
  };
  const stageStatuses = filters.stage === "all" ? null : ORDER_STAGES.find((s) => s.key === filters.stage)!.statuses;
  const where: Prisma.DealerOrderWhereInput = stageStatuses ? { ...baseWhere, status: { in: stageStatuses } } : baseWhere;

  const [grouped, totalFiltered, orders, stations, dealers, prevCount] = await Promise.all([
    prisma.dealerOrder.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    prisma.dealerOrder.count({ where }),
    prisma.dealerOrder.findMany({
      where,
      include: {
        dealerOrganization: { select: { name: true } },
        station: { select: { name: true } },
        lines: { select: { product: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.station.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.dealerOrganization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    filters.range
      ? prisma.dealerOrder.count({
          where: {
            ...baseWhere,
            createdAt: {
              gte: new Date(filters.range.gte.getTime() - (filters.range.lt.getTime() - filters.range.gte.getTime())),
              lt: filters.range.gte,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const counts = new Map<StageKey | "all", number>();
  for (const row of grouped) {
    const key = stageOf(row.status);
    counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    counts.set("all", (counts.get("all") ?? 0) + row._count._all);
  }
  const totalAll = counts.get("all") ?? 0;
  const delta =
    prevCount != null && prevCount > 0 ? Math.round(((totalAll - prevCount) / prevCount) * 100) : null;

  const selectedId = filters.sel && orders.some((o) => o.id === filters.sel) ? filters.sel : orders[0]?.id ?? null;
  const selected = selectedId
    ? await prisma.dealerOrder.findUnique({
        where: { id: selectedId },
        include: {
          dealerOrganization: { select: { name: true } },
          station: { select: { name: true } },
          lines: { select: { product: true, quantityLitres: true } },
          proforma: { select: { number: true } },
        },
      })
    : null;
  const tracker = selected ? dealerTrackerSteps(selected.status) : null;
  /* Preview shows 6 steps: Released + Loading fold into "At Depot". */
  const miniSteps = tracker
    ? [0, 1, 2, [3, 4], 5, 6].map((pick) => {
        const group = (Array.isArray(pick) ? pick : [pick]).map((i) => tracker.steps[i]);
        const state = group.some((s) => s.state === "attention")
          ? "attention"
          : group.some((s) => s.state === "active")
            ? "active"
            : group.every((s) => s.state === "done")
              ? "done"
              : "pending";
        const label = Array.isArray(pick) ? "At Depot" : group[0].label;
        return { label, state };
      })
    : [];

  const pages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const kpis: { key: StageKey; label: string }[] = ORDER_STAGES.filter((s) => s.key !== "quotation" && s.key !== "exceptions").map(
    (s) => ({ key: s.key, label: s.label })
  );
  const tabs: { key: StageKey | "all"; label: string }[] = [{ key: "all", label: "All Orders" }, ...ORDER_STAGES];
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1
  );

  return (
    <div className="so">
      <header className="so-hero">
        <div className="so-hero__text">
          <div className="so-hero__eyebrow">Orders Management</div>
          <h1>Orders</h1>
          <p>Manage dealer fuel orders, confirm payments, issue PFIs and track deliveries.</p>
        </div>
      </header>

      <div className="so-wrap">
        <section className="so-kpis" aria-label="Order totals">
          <Link href={query(filters, { stage: null, page: null, sel: null })} className={`so-kpi${filters.stage === "all" ? " is-active" : ""}`}>
            <span className="so-ico"><ClipboardList size={16} /></span>
            <span className="so-kpi__value">{totalAll}</span>
            <span className="so-kpi__label">Total Orders</span>
            {delta != null ? (
              <span className={`so-kpi__delta${delta < 0 ? " so-kpi__delta--down" : ""}`}>
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs previous period
              </span>
            ) : null}
          </Link>
          {kpis.map((kpi) => {
            const Icon = KPI_ICONS[kpi.key] ?? FileText;
            return (
              <Link
                key={kpi.key}
                href={query(filters, { stage: kpi.key, page: null, sel: null })}
                className={`so-kpi${filters.stage === kpi.key ? " is-active" : ""}`}
              >
                <span className="so-ico"><Icon size={16} /></span>
                <span className="so-kpi__value">{counts.get(kpi.key) ?? 0}</span>
                <span className="so-kpi__label">{kpi.label}</span>
              </Link>
            );
          })}
          <Link href={query(filters, { stage: "quotation", page: null, sel: null })} className={`so-kpi${filters.stage === "quotation" ? " is-active" : ""}`}>
            <span className="so-ico"><FileText size={16} /></span>
            <span className="so-kpi__value">{counts.get("quotation") ?? 0}</span>
            <span className="so-kpi__label">Quotation &amp; PFI</span>
          </Link>
        </section>

        {priceList.message ? (
          <p className="so-card" style={{ marginTop: 16, padding: "12px 16px", fontSize: "0.88rem" }} role={priceList.state === "expired" ? "alert" : "status"}>
            {priceList.message}
          </p>
        ) : null}

        <div className="so-cols">
          <section className="so-card">
            <nav className="so-tabs" aria-label="Order stages">
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={query(filters, { stage: tab.key === "all" ? null : tab.key, page: null, sel: null })}
                  className="so-tab"
                  aria-current={tab.key === filters.stage ? "page" : undefined}
                >
                  {tab.label}
                  <span className="so-tab__count">{counts.get(tab.key) ?? 0}</span>
                </Link>
              ))}
            </nav>

            <form className="so-filters" action="/intelligence/retail/orders" method="get">
              {filters.stage !== "all" ? <input type="hidden" name="stage" value={filters.stage} /> : null}
              <label className="so-field">
                <span>Reporting period</span>
                <select name="period" defaultValue={filters.period}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7d">Last 7 days</option>
                  <option value="month">This month</option>
                  <option value="prev-month">Previous month</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>
              <div className="so-dates" style={filters.period === "custom" ? { display: "flex" } : undefined}>
                <label className="so-field">
                  <span>From</span>
                  <input type="date" name="from" defaultValue={filters.from ?? ""} />
                </label>
                <label className="so-field">
                  <span>To</span>
                  <input type="date" name="to" defaultValue={filters.to ?? ""} />
                </label>
              </div>
              <label className="so-field">
                <span>Station</span>
                <select name="station" defaultValue={filters.stationId ?? ""}>
                  <option value="">All Stations</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="so-field">
                <span>Dealer</span>
                <select name="dealer" defaultValue={filters.dealerId ?? ""}>
                  <option value="">All Dealers</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="so-field so-field--grow">
                <span>Search</span>
                <input name="q" defaultValue={filters.q} maxLength={100} placeholder="Search order, PFI or dealer..." />
              </label>
              <button type="submit" className="so-btn so-btn--gold">Apply</button>
              <Link href="/intelligence/retail/orders" className="so-btn so-btn--line">Clear</Link>
            </form>

            <div className="so-table-wrap">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Order Ref</th>
                    <th>Dealer</th>
                    <th>Station</th>
                    <th>Products</th>
                    <th>Amount (KES)</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const products = [...new Set(order.lines.map((l) => l.product))];
                    return (
                      <tr key={order.id} className={order.id === selectedId ? "is-selected" : undefined}>
                        <td><Link className="so-ref" href={`/intelligence/retail/orders/${order.id}`}>{order.reference}</Link></td>
                        <td>{order.dealerOrganization.name}</td>
                        <td>{order.station.name}</td>
                        <td>
                          <span style={{ display: "inline-flex", gap: 4 }}>
                            {products.map((p) => (
                              <span key={p} className={`so-badge so-badge--${p.toLowerCase()}`}>{p}</span>
                            ))}
                          </span>
                        </td>
                        <td className="so-amount">{formatKes(order.amountDue)}</td>
                        <td><span className={`so-pill so-pill--${stageOf(order.status)}`}>{statusLabel(order.status)}</span></td>
                        <td className="so-updated">{whenLabel(order.updatedAt)}</td>
                        <td>
                          <span className="so-row-actions">
                            <Link href={`${query(filters, { sel: order.id })}#preview`} className="so-icon-link" aria-label={`Preview ${order.reference}`}>
                              <Eye size={15} />
                            </Link>
                            <Link href={`/intelligence/retail/orders/${order.id}`} className="so-icon-link so-icon-link--go" aria-label={`Open ${order.reference}`}>
                              <ArrowRight size={15} />
                            </Link>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 ? (
                    <tr>
                      <td className="so-empty" colSpan={8}>
                        {filters.q ? `No orders match "${filters.q}".` : "No orders match these filters."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="so-pager">
              <span className="so-pager__info">
                Showing {totalFiltered === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalFiltered)} of {totalFiltered} orders
              </span>
              <Link href={query(filters, { page: page > 1 ? String(page - 1) : null, sel: null })} className={`so-page${page <= 1 ? " is-disabled" : ""}`} aria-label="Previous page">‹</Link>
              {pageNumbers.map((n, i) => (
                <span key={n} style={{ display: "inline-flex", gap: 8 }}>
                  {i > 0 && pageNumbers[i - 1] !== n - 1 ? <span className="so-page is-disabled">…</span> : null}
                  <Link href={query(filters, { page: n > 1 ? String(n) : null, sel: null })} className="so-page" aria-current={n === page ? "page" : undefined}>
                    {n}
                  </Link>
                </span>
              ))}
              <Link href={query(filters, { page: page < pages ? String(page + 1) : null, sel: null })} className={`so-page${page >= pages ? " is-disabled" : ""}`} aria-label="Next page">›</Link>
            </div>
          </section>

          <aside id="preview" className="so-preview so-card" aria-label="Order tracking preview">
            <div className="so-card__head">
              <span className="so-ico"><Truck size={15} /></span>
              Order Tracking
              {selected ? (
                <Link className="so-spacer" href={`/intelligence/retail/orders/${selected.id}`} style={{ color: "#3551a5" }}>
                  View Full Details ↗
                </Link>
              ) : null}
            </div>
            {selected ? (
              <div className="so-preview__body">
                <div className="so-preview__ref">{selected.reference}</div>
                <span className={`so-pill so-pill--${stageOf(selected.status)}`}>{statusLabel(selected.status)}</span>
                <div className="so-preview__meta">
                  <span><Building2 size={14} /> {selected.dealerOrganization.name}</span>
                  <span><MapPin size={14} /> {selected.station.name}</span>
                  <span><Calendar size={14} /> Order Date: {whenLabel(selected.createdAt)}</span>
                  <span><Fuel size={14} /> Products: {[...new Set(selected.lines.map((l) => l.product))].join(", ") || "—"}</span>
                  <span><Banknote size={14} /> Order Value: {formatKes(selected.amountDue)}</span>
                </div>
                {tracker?.stopped ? (
                  <div className="so-track__stopped" style={{ margin: "10px 0 0" }}>{tracker.stopped}</div>
                ) : (
                  <div className="so-track" aria-label="Order progress">
                    {miniSteps.map((step, index) => (
                      <span key={step.label} className={`so-track__step is-${step.state}`}>
                        <span className="so-track__dot">{step.state === "done" ? "✓" : index + 1}</span>
                        <span className="so-track__label">{step.label}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="so-preview__actions">
                  <Link href={`/intelligence/retail/orders/${selected.id}`} className="so-btn so-btn--gold"><FileText size={15} /> View Order</Link>
                  {selected.proforma ? (
                    <a href={`/api/orders/${selected.id}/pfi`} target="_blank" rel="noopener" className="so-btn so-btn--line">
                      <FileText size={15} /> View PFI {selected.proforma.number}
                    </a>
                  ) : (
                    <span className="so-preview__hint">No PFI has been issued for this order yet.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="so-preview__body">
                <p className="so-preview__hint">Select an order from the table to see its progress here.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
