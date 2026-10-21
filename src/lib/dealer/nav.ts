export type DealerNavKey =
  | "dashboard"
  | "place-order"
  | "orders"
  | "messaging"
  | "documents"
  | "payments"
  | "deliveries";

/** Which dealer sidebar item to highlight for a page (and the My Orders `?view=` tab). */
export function activeDealerNav(pathname: string, view: string | null): DealerNavKey | null {
  if (pathname === "/dealer/dashboard") return "dashboard";
  if (pathname.startsWith("/dealer/orders/new")) return "place-order";
  if (pathname === "/dealer/orders") {
    if (view === "documents") return "documents";
    if (view === "payment") return "payments";
    if (view === "deliveries") return "deliveries";
    return "orders";
  }
  // A single order always belongs to My Orders, whichever tab it was opened from.
  if (pathname.startsWith("/dealer/orders/")) return "orders";
  if (pathname.startsWith("/dealer/messaging")) return "messaging";
  return null;
}
