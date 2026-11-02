export type DealerNavKey = "dashboard" | "orders" | "pfis" | "messaging";

/** Which dealer menu word to underline for a page. Place order is the yellow button, not a menu word. */
export function activeDealerNav(pathname: string, view: string | null): DealerNavKey | null {
  if (pathname === "/dealer/dashboard") return "dashboard";
  if (pathname.startsWith("/dealer/orders/new")) return null;
  if (pathname === "/dealer/orders") return view === "documents" ? "pfis" : "orders";
  // A single order always belongs to Orders, whichever tab it was opened from.
  if (pathname.startsWith("/dealer/orders/")) return "orders";
  if (pathname.startsWith("/dealer/messaging")) return "messaging";
  return null;
}
