export type DealerNavKey =
  | "dashboard"
  | "orders"
  | "messaging"
  | "support"
  | "stock-reporting"
  | "place-order"
  | "payments"
  | "deliveries";

/** Primary horizontal header tabs. */
export const DEALER_PRIMARY_NAV = [
  { key: "dashboard" as const, href: "/dealer/dashboard", label: "Dashboard" },
  { key: "orders" as const, href: "/dealer/orders", label: "Orders" },
  { key: "messaging" as const, href: "/dealer/messaging", label: "Messages" },
  { key: "support" as const, href: "/dealer/support", label: "Support" },
  {
    key: "stock-reporting" as const,
    href: "/dealer/stock-reporting",
    label: "Stock Sale Reporting",
  },
] as const;

/** Which dealer nav item to highlight for a page (and the My Orders `?view=` tab). */
export function activeDealerNav(pathname: string, view: string | null): DealerNavKey | null {
  if (pathname === "/dealer/dashboard") return "dashboard";
  if (pathname.startsWith("/dealer/orders/new")) return "place-order";
  if (pathname === "/dealer/orders") {
    // documents / payment / deliveries are Orders sub-tabs — keep Orders highlighted
    if (view === "payment") return "payments";
    if (view === "deliveries") return "deliveries";
    return "orders";
  }
  // A single order always belongs under Orders, whichever tab it was opened from.
  if (pathname.startsWith("/dealer/orders/")) return "orders";
  if (pathname.startsWith("/dealer/messaging")) return "messaging";
  if (pathname.startsWith("/dealer/support")) return "support";
  if (pathname.startsWith("/dealer/stock-reporting")) return "stock-reporting";
  return null;
}

export type DealerPrimaryNavKey =
  | "dashboard"
  | "orders"
  | "messaging"
  | "support"
  | "stock-reporting";

/** Which primary header tab is active (maps place-order / payments / deliveries → Orders). */
export function activePrimaryNav(pathname: string, view: string | null): DealerPrimaryNavKey | null {
  const key = activeDealerNav(pathname, view);
  if (key === "dashboard") return "dashboard";
  if (key === "messaging") return "messaging";
  if (key === "support") return "support";
  if (key === "stock-reporting") return "stock-reporting";
  if (key === "orders" || key === "place-order" || key === "payments" || key === "deliveries") {
    return "orders";
  }
  return null;
}
