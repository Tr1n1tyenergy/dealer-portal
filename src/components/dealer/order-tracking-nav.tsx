"use client";

import "./order-tracking-nav.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { orderNeighbours } from "@/lib/orders/dealer-views";

export type OrderNavItem = {
  id: string;
  reference: string;
  stationName: string;
};

export function OrderTrackingNav({
  orders,
  currentId,
}: {
  orders: OrderNavItem[];
  currentId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // `orders` is newest first: Previous opens the older order, Next the newer one.
  const { older: prev, newer: next } = orderNeighbours(orders, currentId);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return orders
      .filter(
        (o) =>
          o.id !== currentId &&
          (o.reference.toLowerCase().includes(q) || o.stationName.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [orders, currentId, query]);

  function goTo(id: string) {
    setQuery("");
    router.push(`/dealer/orders/${id}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (matches[0]) goTo(matches[0].id);
  }

  return (
    <div className="dp-ot-find">
      <form className="dp-ot-find__search" onSubmit={onSubmit} role="search">
        <Search size={15} strokeWidth={2} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find another order..."
          aria-label="Find another order"
          autoComplete="off"
          data-quick-search="page"
        />
        <kbd>⌘K</kbd>
        {matches.length > 0 ? (
          <ul className="dp-ot-find__results">
            {matches.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => goTo(item.id)}>
                  <strong>{item.reference}</strong>
                  <span>{item.stationName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <div className="dp-ot-find__pager">
        {prev ? (
          <Link href={`/dealer/orders/${prev}`} className="dp-ot-page-btn">
            <ChevronLeft size={15} />
            Previous
          </Link>
        ) : (
          <span className="dp-ot-page-btn is-disabled">
            <ChevronLeft size={15} />
            Previous
          </span>
        )}
        {next ? (
          <Link href={`/dealer/orders/${next}`} className="dp-ot-page-btn">
            Next
            <ChevronRight size={15} />
          </Link>
        ) : (
          <span className="dp-ot-page-btn is-disabled">
            Next
            <ChevronRight size={15} />
          </span>
        )}
      </div>
    </div>
  );
}
