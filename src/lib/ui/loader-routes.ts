/** Which brand loader a navigation shows, and what it says. Pure, so it can be tested without a browser. */

export type LoaderKind = "portal" | "page";

const pathOf = (href: string) => href.split(/[?#]/)[0] || "/";

/** The portal or module a path belongs to: "intelligence/<module>", "dealer" or "depot". */
export function portalKey(href: string): string {
  const parts = pathOf(href).split("/").filter(Boolean);
  if (parts[0] === "intelligence") return parts[1] ? `intelligence/${parts[1]}` : "intelligence";
  return parts[0] ?? "";
}

/** The portal orbit when you move into a different portal or module; the page skeleton otherwise. */
export function loaderFor(fromHref: string, toHref: string): LoaderKind {
  return portalKey(fromHref) === portalKey(toHref) ? "page" : "portal";
}

const MODULES: Record<string, string> = {
  "intelligence/retail": "Retail",
  "intelligence/note-taker": "Note Taker",
  "intelligence/presentations": "Presentations",
  "intelligence/admin": "Admin",
  "intelligence/dashboard": "your modules",
  dealer: "Home",
  depot: "Depot Board",
};

const PAGES: Record<string, string> = {
  orders: "Orders",
  analytics: "Analytics",
  messaging: "Messages",
  messages: "Messages",
  support: "Support",
  users: "Users",
  settings: "Settings",
  "stock-reporting": "Stock Reporting",
  notes: "Notes",
};

/** "Retail", "Orders", "Stock Reporting"… for "Opening …" / "Loading …". */
export function destinationLabel(href: string, kind: LoaderKind = "portal"): string {
  // Inside Retail, its start page is the menu's "Home"; from outside it is the Retail module.
  if (kind === "page" && pathOf(href).replace(/\/$/, "") === "/intelligence/retail") return "Home";
  const parts = pathOf(href).split("/").filter(Boolean);
  const page = [...parts].reverse().find((p) => PAGES[p]);
  if (page) return PAGES[page];
  return MODULES[portalKey(href)] ?? "the page";
}

/**
 * Where a Next page-data (RSC) request is going: its path and query without the `_rsc` cache-buster.
 * Navigations started by code (router.push) have no clicked link, so this is how we know the destination.
 */
/** Path plus query, ignoring hash and the Next `_rsc` cache buster, so two links to the same view match. */
export function routeKey(href: string, base = "http://localhost"): string {
  try {
    const url = new URL(href, base);
    url.searchParams.delete("_rsc");
    const entries = [...url.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
    );
    const path = url.pathname.replace(/\/$/, "") || "/";
    const query = new URLSearchParams(entries).toString();
    return query ? `${path}?${query}` : path;
  } catch {
    return href;
  }
}

/**
 * The overlay stays until the address is the destination and the page underneath
 * is no longer the previous view or the route skeleton.
 */
export function viewHasArrived(params: {
  from: string;
  expected: string | null;
  here: string;
  startSignature: string;
  signature: string;
}): boolean {
  const hereKey = routeKey(params.here);
  const fromKey = routeKey(params.from);
  // A redirect may land on a different address than the link that was clicked.
  // Either way the address has to have moved, and the view underneath has to be the new one.
  const addressMoved = params.expected
    ? hereKey === routeKey(params.expected) || hereKey !== fromKey
    : hereKey !== fromKey;
  if (!addressMoved) return false;
  if (params.signature === "loading" || params.signature === "") return false;
  if (params.signature === params.startSignature) return false;
  return true;
}

export function rscTarget(input: string | URL | { url: string }, base: string): string | undefined {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin) return undefined;
    url.searchParams.delete("_rsc");
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const SPLASH_KEY = "tri-splash";
/** PortalLogin dispatches this on window after marking the splash, since sign-in moves on without a reload. */
export const SPLASH_START_EVENT = "tri:splash-start";

/** Called on a successful sign-in, just before redirecting. */
export function markSplashPending(storage: Store): void {
  try {
    storage.setItem(SPLASH_KEY, "1");
  } catch {
    // Private mode or blocked storage: no splash, nothing breaks.
  }
}

/** True once after a sign-in; clears the flag so the splash never shows twice. */
export function takeSplash(storage: Store): boolean {
  try {
    const pending = storage.getItem(SPLASH_KEY) === "1";
    if (pending) storage.removeItem(SPLASH_KEY);
    return pending;
  } catch {
    return false;
  }
}
