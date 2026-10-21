"use client";

import "./recent-orders.css";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Droplets,
  Filter,
  Fuel,
  LayoutList,
  MapPin,
  MoreVertical,
  Search,
} from "lucide-react";

import type { RecentOrderRow } from "@/lib/orders/dealer-views";

export type { RecentOrderRow };

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
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

function litres(n: number) {
  return `${n.toLocaleString()} L`;
}

export function RecentOrders({
  orders,
  stations,
}: {
  orders: RecentOrderRow[];
  stations: string[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [station, setStation] = useState("all");

  const statusOptions = useMemo(() => {
    const set = new Set(orders.map((o) => o.statusLabel));
    return Array.from(set).sort();
  }, [orders]);

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
    <article className="dp-ro" id="orders">
      <div className="dp-ro__head">
        <div>
          <div className="dp-ro__title">
            <LayoutList size={18} strokeWidth={1.8} />
            Recent Orders
          </div>
          <p>Your latest fuel orders and their current status.</p>
        </div>
        <Link href="/dealer/orders" className="dp-ro__all">
          View all orders →
        </Link>
      </div>

      <div className="dp-ro__filters">
        <label className="dp-ro__search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order number, station, or reference..."
          />
        </label>
        <label className="dp-ro__select">
          <Filter size={14} className="dp-ro__select-ico" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="dp-ro__select">
          <MapPin size={14} className="dp-ro__select-ico" />
          <select value={station} onChange={(e) => setStation(e.target.value)}>
            <option value="all">All Stations</option>
            {stations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="dp-ro__select">
          <Calendar size={14} className="dp-ro__select-ico" />
          <select defaultValue="30" disabled>
            <option value="30">Last 30 Days</option>
          </select>
        </label>
      </div>

      <div className="dp-ro__scroll">
        <table className="dp-ro__table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Station</th>
              <th>Products &amp; Quantities</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>
                  <div className="dp-ro__order">
                    <strong>{order.reference}</strong>
                    <span>{formatDay(order.createdAt)}</span>
                  </div>
                </td>
                <td>
                  <div className="dp-ro__station">
                    <span
                      className="dp-ro__thumb"
                      style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
                      aria-hidden
                    />
                    <div>
                      <strong>{order.stationName}</strong>
                      <em>
                        <i /> Active
                      </em>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="dp-ro__products">
                    {order.pms != null ? (
                      <div className="is-pms">
                        <Droplets size={14} />
                        <span>PMS</span>
                        <b>{litres(order.pms)}</b>
                      </div>
                    ) : null}
                    {order.ago != null ? (
                      <div className="is-ago">
                        <Fuel size={14} />
                        <span>AGO</span>
                        <b>{litres(order.ago)}</b>
                      </div>
                    ) : null}
                    {order.pms == null && order.ago == null ? <span>—</span> : null}
                  </div>
                </td>
                <td>
                  <span className={`dp-ro__badge is-${order.tone}`}>
                    <i />
                    {order.statusLabel}
                  </span>
                </td>
                <td>
                  <div className="dp-ro__updated">
                    <strong>{formatDateTime(order.updatedAt)}</strong>
                    <span>{relativeTime(order.updatedAt)}</span>
                  </div>
                </td>
                <td>
                  <div className="dp-ro__actions">
                    <Link href={`/dealer/orders/${order.id}`} className="dp-ro__view">
                      View
                      <ArrowRight size={14} />
                    </Link>
                    <button type="button" className="dp-ro__more" aria-label="More actions">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="dp-ro__empty">
                  {orders.length === 0
                    ? "No orders yet. Place a fuel order when you are ready."
                    : "No orders match your filters."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}
