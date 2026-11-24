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
export function destinationLabel(href: string): string {
  const parts = pathOf(href).split("/").filter(Boolean);
  const page = [...parts].reverse().find((p) => PAGES[p]);
  if (page) return PAGES[page];
  return MODULES[portalKey(href)] ?? "the page";
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const SPLASH_KEY = "tri-splash";

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
