"use client";

import "./recent-orders.css";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { RecentOrderRow } from "@/lib/orders/dealer-views";
import { dealerStatusLabel } from "@/lib/orders/state-machine";
import { StatusChip } from "@/components/ui/status-chip";

export type { RecentOrderRow };

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDay(iso);
}

function fuel(order: RecentOrderRow) {
  const parts = [
    order.pms != null ? `PMS ${order.pms.toLocaleString()} L` : null,
    order.ago != null ? `AGO ${order.ago.toLocaleString()} L` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

/** The dealer's orders: tabs, search and filters, then one row per order that opens it. */
export function RecentOrders({
  orders,
  stations,
  initialQuery = "",
  tabs,
  emptyMessage = "No orders yet. Place a fuel order when you are ready.",
}: {
  orders: RecentOrderRow[];
  stations: string[];
  initialQuery?: string;
  /** Links to the Orders tabs; the active one is marked for screen readers. */
  tabs?: { label: string; href: string; active: boolean }[];
  /** Shown when there are no orders to list (e.g. nothing on this tab). */
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("all");
  const [station, setStation] = useState("all");

  const statusOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.statusLabel))).sort(), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.statusLabel !== status) return false;
      if (station !== "all" && o.stationName !== station) return false;
      if (!q) return true;
      return (
        o.reference.toLowerCase().includes(q) ||
        o.stationName.toLowerCase().includes(q) ||
        o.statusLabel.toLowerCase().includes(q)
      );
    });
  }, [orders, query, status, station]);

  return (
    <section className="ro" id="orders" aria-label="Orders">
      {tabs ? (
        <nav className="ui-tabs ro__tabs" aria-label="Order views">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="ui-navlink" aria-current={tab.active ? "page" : undefined}>
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="ro__filters">
        <label className="ro__search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            className="ui-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order number, station or status"
            aria-label="Search orders"
            data-quick-search="page"
          />
        </label>
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {stations.length > 1 ? (
          <select className="ui-input" value={station} onChange={(e) => setStation(e.target.value)} aria-label="Station">
            <option value="all">All stations</option>
            {stations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="ro__empty">{orders.length === 0 ? emptyMessage : "No orders match your filters."}</p>
      ) : (
        <ul className="ro__list">
          {filtered.map((order) => (
            <li key={order.id} className="ro__item">
              <Link href={`/dealer/orders/${order.id}`} className="ro__row">
                <span className="ro__ref">
                  <b>{order.reference}</b>
                  <span>{formatDay(order.createdAt)}</span>
                </span>
                <span className="ro__station">{order.stationName}</span>
                <span className="ro__fuel">{fuel(order)}</span>
                <span className="ro__chip">
                  <StatusChip status={order.status} label={order.statusLabel || dealerStatusLabel(order.status)} />
                </span>
                <span className="ro__updated" title={formatDateTime(order.updatedAt)}>
                  {relativeTime(order.updatedAt)}
                </span>
              </Link>
              {order.hasPfi ? (
                <a href={`/api/orders/${order.id}/pfi`} target="_blank" rel="noopener" className="ui-navlink ro__pfi">
                  View PFI
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
