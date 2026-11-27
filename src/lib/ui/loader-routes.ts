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
  login: "Sign In",
  access: "Access",
};

/** "Retail", "Orders", "Stock Reporting"… for portal "Opening …" / page "Loading …". */
export function destinationLabel(href: string, kind: LoaderKind = "portal"): string {
  // Inside Retail, its start page is the menu's "Home"; from outside it is the Retail module.
  if (kind === "page" && pathOf(href).replace(/\/$/, "") === "/intelligence/retail") return "Home";
  const parts = pathOf(href).split("/").filter(Boolean);
  const page = [...parts].reverse().find((p) => PAGES[p]);
  if (page) return PAGES[page];
  return MODULES[portalKey(href)] ?? "the page";
}

/** Sentence-case status line for the under-header page skeleton (not the portal orbit). */
const PREPARING_BY_LABEL: Record<string, string> = {
  Home: "Preparing your dashboard...",
  Orders: "Preparing your orders...",
  Analytics: "Preparing your analytics...",
  Messages: "Preparing your messages...",
  Support: "Preparing your support centre...",
  Users: "Preparing user management...",
  Settings: "Preparing your settings...",
  "Stock Reporting": "Preparing your stock reports...",
  Notes: "Preparing your notes...",
  "Note Taker": "Preparing Note Taker...",
  Presentations: "Preparing your presentations...",
  Admin: "Preparing admin...",
  "Depot Board": "Preparing your depot board...",
  "your modules": "Preparing your modules...",
  Retail: "Preparing your dashboard...",
  "Sign In": "Preparing sign in...",
  Access: "Preparing access...",
  "the page": "Preparing your page...",
};

/** "Preparing your orders..." from a short destination label or path. */
export function preparingMessage(labelOrHref: string, kind: LoaderKind = "page"): string {
  const looksLikePath = labelOrHref.startsWith("/");
  const label = looksLikePath ? destinationLabel(labelOrHref, kind) : labelOrHref;
  return PREPARING_BY_LABEL[label] ?? `Preparing your ${label.toLowerCase()}...`;
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
 * The overlay stays until the address has left the starting page and the route skeleton
 * is gone. Login/access pages have no portal shell; an empty signature there still means arrived.
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

  // Same-URL UI change (tabs): wait for the content fingerprint to change.
  if (!params.expected) {
    if (params.signature === "loading" || !params.signature) return false;
    return params.signature !== params.startSignature;
  }

  // Still on the page we left from.
  if (hereKey === fromKey) return false;

  // Destination route is resolving its loading.tsx skeleton.
  if (params.signature === "loading") return false;

  // No portal shell (login, access, etc.) — the new URL is enough.
  if (!params.signature || !params.startSignature) return true;

  // Soft nav: URL can move a frame before React swaps the view. Wait until content changes.
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
