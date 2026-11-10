"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Layers,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import type { DealerOrderView, RecentOrderRow } from "@/lib/orders/dealer-views";
import { DEALER_ORDER_VIEWS, emptyOrdersMessage } from "@/lib/orders/dealer-views";

type Props = {
  orders: RecentOrderRow[];
  view: DealerOrderView;
  accountEmpty: boolean;
  initialQuery?: string;
};

const TAB_ICONS = {
  all: Package,
  payment: CreditCard,
  documents: FileText,
  deliveries: Truck,
} as const;

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 60) return mins <= 1 ? "1 minute ago" : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function litres(n: number) {
  return `${new Intl.NumberFormat("en-KE").format(n)} L`;
}

function productsLabel(order: RecentOrderRow) {
  const parts: string[] = [];
  if (order.pms != null) parts.push(`PMS ${litres(order.pms)}`);
  if (order.ago != null) parts.push(`AGO ${litres(order.ago)}`);
  return parts.length ? parts.join(" · ") : "—";
}

function iconTone(index: number) {
  return (["a", "b", "c", "d"] as const)[index % 4];
}

function pillClass(tone: string, label: string) {
  const lower = label.toLowerCase();
  if (tone === "delivered" || lower.includes("delivered") || lower.includes("closed")) {
    return "is-delivered";
  }
  if (
    tone === "transit" ||
    lower.includes("released") ||
    lower.includes("loading") ||
    lower.includes("dispatched") ||
    lower.includes("transit")
  ) {
    return "is-transit";
  }
  if (tone === "payment" || lower.includes("payment confirmed") || lower.includes("awaiting payment")) {
    return lower.includes("review") || lower.includes("exception") ? "is-review" : "is-payment";
  }
  if (tone === "review" || lower.includes("review") || lower.includes("exception")) return "is-review";
  if (tone === "pfi") return "is-pfi";
  return "is-processing";
}

function inDateRange(iso: string, range: string) {
  if (range === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  if (range === "today") {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  if (range === "7d") {
    return now.getTime() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }
  if (range === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true;
}

export function OrdersManagement({ orders, view, accountEmpty, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const statusOptions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.statusLabel))).sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.statusLabel !== status) return false;
      if (!inDateRange(order.createdAt, dateRange)) return false;
      if (!q) return true;
      return (
        order.reference.toLowerCase().includes(q) ||
        order.stationName.toLowerCase().includes(q) ||
        order.statusLabel.toLowerCase().includes(q)
      );
    });
  }, [orders, query, status, dateRange]);

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setDateRange("all");
  }

  const filtersActive = query.trim() !== "" || status !== "all" || dateRange !== "all";

  return (
    <>
      <div className="do__tabs-wrap">
        <div className="do__inner">
          <nav className="do__tabs" aria-label="Order categories">
            {DEALER_ORDER_VIEWS.map((tab) => {
              const Icon = TAB_ICONS[tab.view];
              const active = tab.view === view;
              return (
                <Link
                  key={tab.view}
                  href={tab.href}
                  className={`do__tab${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} strokeWidth={2.1} aria-hidden />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="do__inner">
        <div className="do__filters">
          <label className="do__search">
            <Search size={16} color="#3853a4" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order number, station or status"
              aria-label="Search orders"
            />
          </label>
          <label className="do__select">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown size={15} color="#3853a4" aria-hidden />
          </label>
          <label className="do__select">
            <Clock size={15} color="#3853a4" aria-hidden />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Filter by date"
            >
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="month">This month</option>
            </select>
            <ChevronDown size={15} color="#3853a4" aria-hidden />
          </label>
        </div>

        <section className="do__table-card" aria-label="Orders">
          {filtered.length === 0 ? (
            <div className="do__empty">
              <div className="do__empty-icon" aria-hidden>
                <Package size={22} strokeWidth={2} />
              </div>
              {accountEmpty ? (
                <>
                  <h2>No orders yet</h2>
                  <p>You haven&apos;t placed any fuel orders. Create your first order to get started.</p>
                  <Link href="/dealer/orders/new" className="do__empty-cta">
                    <ShoppingCart size={15} aria-hidden />
                    Place your first order
                  </Link>
                </>
              ) : filtersActive ? (
                <>
                  <h2>No matching orders</h2>
                  <p>No orders match your current filters.</p>
                  <button type="button" className="do__clear" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <h2>No orders in this view</h2>
                  <p>{emptyOrdersMessage(view)}</p>
                </>
              )}
            </div>
          ) : (
            <div className="do__scroll">
              <table className="do__table">
                <thead>
                  <tr>
                    <th>
                      <span className="do__th">
                        <FileText size={13} aria-hidden />
                        Order number
                      </span>
                    </th>
                    <th>
                      <span className="do__th">
                        <MapPin size={13} aria-hidden />
                        Station
                      </span>
                    </th>
                    <th>
                      <span className="do__th">
                        <Layers size={13} aria-hidden />
                        Products &amp; quantities
                      </span>
                    </th>
                    <th>
                      <span className="do__th">
                        <Activity size={13} aria-hidden />
                        Status
                      </span>
                    </th>
                    <th>
                      <span className="do__th">
                        <Clock size={13} aria-hidden />
                        Last updated
                      </span>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, index) => (
                    <tr key={order.id}>
                      <td data-label="Order">
                        <div className="do__order">
                          <span className={`do__order-ico is-${iconTone(index)}`} aria-hidden>
                            <FileText size={14} strokeWidth={2.1} />
                          </span>
                          <div>
                            <Link href={`/dealer/orders/${order.id}`} className="do__order-ref">
                              {order.reference}
                            </Link>
                            <span className="do__order-date">{formatDay(order.createdAt)}</span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Station">
                        <span className="do__station">{order.stationName}</span>
                      </td>
                      <td data-label="Products">
                        <span className="do__products">{productsLabel(order)}</span>
                      </td>
                      <td data-label="Status">
                        <span className={`do__pill ${pillClass(order.tone, order.statusLabel)}`}>
                          {order.statusLabel}
                        </span>
                      </td>
                      <td data-label="Updated">
                        <span className="do__updated">{relativeTime(order.updatedAt)}</span>
                      </td>
                      <td data-label="Action">
                        {order.hasPfi ? (
                          <a
                            href={`/api/orders/${order.id}/pfi`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="do__action"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText size={13} aria-hidden />
                            View PFI
                            <ChevronRight size={13} aria-hidden />
                          </a>
                        ) : (
                          <Link href={`/dealer/orders/${order.id}`} className="do__action is-muted">
                            View order
                            <ChevronRight size={13} aria-hidden />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
