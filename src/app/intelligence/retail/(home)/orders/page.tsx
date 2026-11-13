import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Fuel,
  Layers,
  MapPinned,
  Search,
  Truck,
} from "lucide-react";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { likeLiteral } from "@/lib/search";
import { requireInternal } from "@/lib/session";
import { formatKes } from "@/lib/orders/money";
import { ORDER_STAGES, stageOf, statusLabel, type StaffStageFilter } from "@/lib/orders/stages";
import { staffOrderFilters, type StaffOrderFilters } from "@/lib/orders/staff-views";
import { dealerTrackerSteps, trackerStepSecondary } from "@/lib/orders/state-machine";
import { StaffOrdersPeriodFilter } from "@/components/staff/staff-orders-period-filter";
import "@/app/intelligence/retail/staff-orders.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 10;

const TRACKABLE_STATUSES = new Set([
  "RELEASED_TO_DEPOT",
  "LOADING",
  "LOADED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CLOSED",
]);

/** KPI row from Attachment 3 — Quotation & Payment Confirmed stay in workflow, not as summary cards. */
const KPI_CARDS: {
  key: StaffStageFilter;
  label: string;
  icon: typeof Layers;
  tone: "blue" | "gold" | "card" | "doc" | "depot" | "transit" | "done";
}[] = [
  { key: "all", label: "Total Orders", icon: Layers, tone: "blue" },
  { key: "awaiting-payment", label: "Awaiting Payment", icon: Clock3, tone: "gold" },
  { key: "checking-payment", label: "Checking Payment", icon: CreditCard, tone: "card" },
  { key: "pfi-issued", label: "PFI Issued", icon: FileText, tone: "doc" },
  { key: "depot", label: "At Depot", icon: Truck, tone: "depot" },
  { key: "transit", label: "In Transit", icon: Truck, tone: "transit" },
  { key: "complete", label: "Completed", icon: CheckCircle2, tone: "done" },
];

/** Status tabs — PFI Issued & Exceptions omitted from the filter strip. */
const VISIBLE_TABS: { key: StaffStageFilter; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "awaiting-payment", label: "Awaiting Payment" },
  { key: "checking-payment", label: "Checking Payment" },
  { key: "depot", label: "At Depot" },
  { key: "transit", label: "In Transit" },
  { key: "complete", label: "Completed" },
];

function query(filters: StaffOrderFilters, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams();
  const base: Record<string, string | null> = {
    stage: filters.stage === "all" ? null : filters.stage,
    q: filters.q || null,
    period: filters.period === "all" ? null : filters.period,
    from: filters.from,
    to: filters.to,
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
  return at.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
}

function stageWhere(stage: StaffStageFilter): Prisma.DealerOrderWhereInput | null {
  if (stage === "all") return null;
  if (stage === "pfi-issued") return { proforma: { isNot: null } };
  const statuses = ORDER_STAGES.find((s) => s.key === stage)?.statuses;
  return statuses ? { status: { in: statuses } } : null;
}

export const maxDuration = 60;

export default async function RetailOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");

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
    ...(filters.dealerId ? { dealerOrganizationId: filters.dealerId } : {}),
    ...(filters.range ? { createdAt: { gte: filters.range.gte, lt: filters.range.lt } } : {}),
  };
  const stageClause = stageWhere(filters.stage);
  const where: Prisma.DealerOrderWhereInput = stageClause ? { ...baseWhere, ...stageClause } : baseWhere;

  const [grouped, totalFiltered, orders, dealers, prevCount, pfiIssuedCount] = await Promise.all([
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
    prisma.dealerOrder.count({ where: { ...baseWhere, proforma: { isNot: null } } }),
  ]);

  const counts = new Map<StaffStageFilter, number>();
  for (const row of grouped) {
    const key = stageOf(row.status);
    counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    counts.set("all", (counts.get("all") ?? 0) + row._count._all);
  }
  counts.set("pfi-issued", pfiIssuedCount);
  const totalAll = counts.get("all") ?? 0;
  const delta =
    prevCount != null && prevCount > 0 ? Math.round(((totalAll - prevCount) / prevCount) * 100) : null;
  const deltaLabel =
    filters.period === "7d"
      ? "vs last 7 days"
      : filters.period === "month"
        ? "vs previous month"
        : "vs previous period";

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

  const pages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  const canTrack = Boolean(selected && TRACKABLE_STATUSES.has(selected.status));

  return (
    <div className="so">
      <header className="so-hero" aria-label="Orders management hero">
        <div className="so-hero__text">
          <div className="so-hero__eyebrow">Orders Management</div>
          <h1>Orders</h1>
          <p>Manage dealer fuel orders, confirm payments, issue PFIs and track deliveries.</p>
        </div>
      </header>

      <div className="so-wrap">
        <section className="so-kpis" aria-label="Order totals">
          {KPI_CARDS.map((kpi) => {
            const Icon = kpi.icon;
            const active = filters.stage === kpi.key;
            const href = query(filters, {
              stage: kpi.key === "all" ? null : kpi.key,
              page: null,
              sel: null,
            });
            return (
              <Link key={kpi.key} href={href} className={`so-kpi${active ? " is-active" : ""}`}>
                <span className={`so-ico so-ico--${kpi.tone}`}>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="so-kpi__text">
                  <span className="so-kpi__label">{kpi.label}</span>
                  <span className="so-kpi__value">{counts.get(kpi.key) ?? 0}</span>
                  {kpi.key === "all" && delta != null ? (
                    <span className={`so-kpi__delta${delta < 0 ? " so-kpi__delta--down" : ""}`}>
                      {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}
                      {Math.abs(delta)}% {deltaLabel}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </section>

        <div className="so-cols">
          <section className="so-card so-card--workspace">
            <nav className="so-tabs" aria-label="Order stages">
              {VISIBLE_TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={query(filters, { stage: tab.key === "all" ? null : tab.key, page: null, sel: null })}
                  className="so-tab"
                  aria-current={tab.key === filters.stage ? "page" : undefined}
                >
                  {tab.label} ({counts.get(tab.key) ?? 0})
                </Link>
              ))}
            </nav>

            <form className="so-filters" action="/intelligence/retail/orders" method="get">
              {filters.stage !== "all" ? <input type="hidden" name="stage" value={filters.stage} /> : null}
              <StaffOrdersPeriodFilter period={filters.period} from={filters.from} to={filters.to} />
              <label className="so-field so-field--dealer">
                <span>Dealer</span>
                <select name="dealer" defaultValue={filters.dealerId ?? ""}>
                  <option value="">All Dealers</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="so-field so-field--grow so-field--search">
                <span className="so-field__label-sr">Search</span>
                <span className="so-search">
                  <Search size={15} strokeWidth={1.75} aria-hidden />
                  <input
                    name="q"
                    defaultValue={filters.q}
                    maxLength={100}
                    placeholder="Search order, PFI or dealer..."
                    aria-label="Search order, PFI or dealer"
                  />
                </span>
              </label>
              <div className="so-filters__actions">
                <button type="submit" className="so-btn so-btn--gold">
                  Apply
                </button>
                <Link href="/intelligence/retail/orders" className="so-btn so-btn--line">
                  Clear
                </Link>
              </div>
            </form>

            <div className="so-table-shell">
              <div className="so-table-scroll">
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const products = [...new Set(order.lines.map((l) => l.product))];
                      return (
                        <tr key={order.id} className={order.id === selectedId ? "is-selected" : undefined}>
                          <td>
                            <Link className="so-ref" href={`/intelligence/retail/orders/${order.id}`}>
                              {order.reference}
                            </Link>
                          </td>
                          <td>{order.dealerOrganization.name}</td>
                          <td>{order.station.name}</td>
                          <td>
                            <span className="so-products">
                              {products.map((p) => (
                                <span key={p} className={`so-badge so-badge--${p.toLowerCase()}`}>
                                  {p}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="so-amount">{formatKes(order.amountDue)}</td>
                          <td>
                            <span className={`so-pill so-pill--${stageOf(order.status)}`}>
                              {statusLabel(order.status)}
                            </span>
                          </td>
                          <td className="so-updated">{whenLabel(order.updatedAt)}</td>
                          <td>
                            <Link
                              href={`/intelligence/retail/orders/${order.id}`}
                              className="so-icon-link so-icon-link--go"
                              aria-label={`Open ${order.reference}`}
                            >
                              <ArrowRight size={15} strokeWidth={2} />
                            </Link>
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
            </div>

            <div className="so-pager">
              <span className="so-pager__info">
                Showing {totalFiltered === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalFiltered)} of {totalFiltered} orders
              </span>
              <div className="so-pager__pages">
                <Link
                  href={query(filters, { page: page > 1 ? String(page - 1) : null, sel: null })}
                  className={`so-page${page <= 1 ? " is-disabled" : ""}`}
                  aria-label="Previous page"
                >
                  ‹
                </Link>
                {pageNumbers.map((n, i) => (
                  <span key={n} className="so-pager__chunk">
                    {i > 0 && pageNumbers[i - 1] !== n - 1 ? <span className="so-page is-disabled">…</span> : null}
                    <Link
                      href={query(filters, { page: n > 1 ? String(n) : null, sel: null })}
                      className="so-page"
                      aria-current={n === page ? "page" : undefined}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
                <Link
                  href={query(filters, { page: page < pages ? String(page + 1) : null, sel: null })}
                  className={`so-page${page >= pages ? " is-disabled" : ""}`}
                  aria-label="Next page"
                >
                  ›
                </Link>
              </div>
            </div>
          </section>

          <aside id="preview" className="so-preview so-card" aria-label="Order tracking preview">
            <div className="so-card__head">
              <span className="so-ico so-ico--transit">
                <Truck size={15} strokeWidth={1.75} />
              </span>
              <span className="so-card__title">Order Tracking</span>
              {selected ? (
                <Link className="so-spacer" href={`/intelligence/retail/orders/${selected.id}`}>
                  View Full Details ↗
                </Link>
              ) : null}
            </div>
            {selected && tracker ? (
              <div className="so-preview__body">
                <div className="so-preview__heading">
                  <div className="so-preview__ref">{selected.reference}</div>
                  <span className={`so-pill so-pill--${stageOf(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>
                <div className="so-preview__meta">
                  <span>
                    <span className="so-preview__ico" aria-hidden>
                      <Building2 size={17} strokeWidth={1.75} />
                    </span>
                    {selected.dealerOrganization.name}
                  </span>
                  <span>
                    <span className="so-preview__ico" aria-hidden>
                      <MapPinned size={17} strokeWidth={1.75} />
                    </span>
                    {selected.station.name}
                  </span>
                  <span>
                    <span className="so-preview__ico" aria-hidden>
                      <CalendarDays size={17} strokeWidth={1.75} />
                    </span>
                    Order Date: {whenLabel(selected.createdAt)}
                  </span>
                  <span>
                    <span className="so-preview__ico" aria-hidden>
                      <Fuel size={17} strokeWidth={1.75} />
                    </span>
                    Products: {[...new Set(selected.lines.map((l) => l.product))].join(", ") || "—"}
                  </span>
                  <span>
                    <span className="so-preview__ico" aria-hidden>
                      <Banknote size={17} strokeWidth={1.75} />
                    </span>
                    Order Value: {formatKes(selected.amountDue)}
                  </span>
                </div>
                {tracker.stopped ? <div className="so-track__stopped">{tracker.stopped}</div> : null}
                <ol
                  className={`so-progress${tracker.stopped ? " is-stopped" : ""}`}
                  aria-label="Order progress"
                >
                  {tracker.steps.map((step, index) => {
                    const next = tracker.steps[index + 1];
                    const connectorClass =
                      step.state === "done"
                        ? next && next.state !== "done"
                          ? "is-active"
                          : "is-done"
                        : "";
                    const isCurrent = step.state === "active" || step.state === "attention";
                    return (
                      <li
                        key={step.key}
                        className={`so-progress__step is-${step.state}`}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        <div className="so-progress__rail">
                          <div className="so-progress__node">
                            <span className="so-progress__dot">
                              {step.state === "done" ? (
                                <Check size={14} strokeWidth={3} />
                              ) : step.state === "attention" ? (
                                "!"
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className="so-progress__label">{step.label}</span>
                            <small className="so-progress__note">{trackerStepSecondary(step)}</small>
                          </div>
                          {index < tracker.steps.length - 1 ? (
                            <span className={`so-progress__line ${connectorClass}`} aria-hidden />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="so-preview__actions">
                  <Link href={`/intelligence/retail/orders/${selected.id}`} className="so-btn so-btn--gold">
                    <FileText size={14} strokeWidth={1.75} /> View Order
                  </Link>
                  {selected.proforma ? (
                    <a
                      href={`/api/orders/${selected.id}/pfi`}
                      target="_blank"
                      rel="noopener"
                      className="so-btn so-btn--pfi"
                    >
                      <FileText size={14} strokeWidth={1.75} /> View PFI
                    </a>
                  ) : (
                    <span className="so-btn so-btn--pfi is-disabled" aria-disabled="true" title="No PFI issued yet">
                      <FileText size={14} strokeWidth={1.75} /> View PFI
                    </span>
                  )}
                  {canTrack ? (
                    <Link href={`/intelligence/retail/orders/${selected.id}#tracking`} className="so-btn so-btn--line">
                      <Truck size={14} strokeWidth={1.75} /> Track Delivery
                    </Link>
                  ) : (
                    <span
                      className="so-btn so-btn--line is-disabled"
                      aria-disabled="true"
                      title="Delivery tracking unlocks after release to depot"
                    >
                      <Truck size={14} strokeWidth={1.75} /> Track Delivery
                    </span>
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
