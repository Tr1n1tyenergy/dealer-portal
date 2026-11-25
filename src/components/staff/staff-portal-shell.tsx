"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, ChevronDown, KeyRound, LogOut, Search } from "lucide-react";
import { ModuleSwitcher } from "@/components/staff/module-switcher";
import { fitCount } from "@/lib/nav/fit";
import { canUser, type StaffUser } from "@/lib/permissions";
import { AccessibilityMenu } from "@/components/a11y/accessibility-menu";
import { cn } from "@/lib/utils";
import "./staff-portal.css";
import "@/app/intelligence/retail/staff-portal-hero.css";

export type StaffPortalNavKey =
  | "home"
  | "orders"
  | "analytics"
  | "messages"
  | "support"
  | "users"
  | "settings"
  | "stock-reporting";

function activeKey(pathname: string): StaffPortalNavKey {
  if (pathname.startsWith("/intelligence/retail/orders")) return "orders";
  if (pathname.startsWith("/intelligence/retail/analytics")) return "analytics";
  if (pathname.startsWith("/intelligence/retail/messaging")) return "messages";
  if (pathname.startsWith("/intelligence/retail/support")) return "support";
  if (pathname.startsWith("/intelligence/retail/users")) return "users";
  if (pathname.startsWith("/intelligence/retail/settings") || pathname.startsWith("/intelligence/admin/settings")) {
    return "settings";
  }
  if (pathname.startsWith("/intelligence/retail/stock-reporting")) return "stock-reporting";
  if (pathname === "/intelligence/retail" || pathname === "/intelligence/retail/") return "home";
  return "home";
}

type NavItem = { key: StaffPortalNavKey; href: string; label: string };

/** Tabs that don't fit the header width move into "More" (8.2: nothing gets cut off). */
function FitNav({ items, active }: { items: NavItem[]; active: StaffPortalNavKey }) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(items.length);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;
    const run = () => {
      const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const els = Array.from(measure.children) as HTMLElement[];
      const widths = els.slice(0, -1).map((el) => el.offsetWidth + gap);
      setFit(fitCount(widths, nav.clientWidth, els[els.length - 1].offsetWidth + gap));
    };
    run();
    void document.fonts?.ready?.then(run);
    const ro = new ResizeObserver(run);
    ro.observe(nav);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !moreRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const shown = items.slice(0, fit);
  const rest = items.slice(fit);
  return (
    <nav className="sp-nav" aria-label="Staff Portal" ref={navRef}>
      <div className="sp-nav__measure" ref={measureRef} aria-hidden>
        {items.map((it) => (
          <span key={it.key} className="sp-nav__link is-active">
            {it.label}
          </span>
        ))}
        <span className="sp-nav__link">
          More <ChevronDown size={14} />
        </span>
      </div>
      {shown.map((it) => (
        <Link key={it.key} href={it.href} className={cn("sp-nav__link", active === it.key && "is-active")}>
          {it.label}
        </Link>
      ))}
      {rest.length ? (
        <div className="sp-nav__menu" ref={moreRef}>
          <button
            type="button"
            className={cn("sp-nav__link", rest.some((it) => it.key === active) && "is-active")}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            More <ChevronDown size={14} aria-hidden />
          </button>
          {open ? (
            <div className="sp-nav__dropdown" role="menu">
              {rest.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  role="menuitem"
                  aria-current={active === it.key ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

export function StaffPortalShell({
  user,
  notificationCount = 0,
  children,
}: {
  user: StaffUser & {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  notificationCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeKey(pathname);
  const [userOpen, setUserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false);
      if (searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.name?.trim() ||
    (user.role === "SUPER_ADMIN" ? "Super Admin" : "Staff");
  const initials = (() => {
    const fromParts = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
    if (fromParts) return fromParts;
    const bits = displayName.split(/\s+/).filter(Boolean);
    if (bits.length >= 2) return `${bits[0][0]}${bits[1][0]}`.toUpperCase();
    return (bits[0]?.[0] ?? "S").toUpperCase();
  })();

  const showOrders = canUser(user, "orders", "view");
  const showAnalytics = canUser(user, "analytics", "view");
  const showMessages = canUser(user, "messaging", "view");
  const showSupport = canUser(user, "support", "view");
  const showUsers = canUser(user, "retailUsers", "view");
  const showSettings = canUser(user, "settings", "view");
  const showStockReporting =
    canUser(user, "stockReporting", "view") || showAnalytics || showOrders;

  const navItems: NavItem[] = [
    { key: "home", href: "/intelligence/retail", label: "Home" },
    showOrders && { key: "orders", href: "/intelligence/retail/orders", label: "Orders" },
    showAnalytics && { key: "analytics", href: "/intelligence/retail/analytics", label: "Analytics" },
    showMessages && { key: "messages", href: "/intelligence/retail/messaging", label: "Messages" },
    showSupport && { key: "support", href: "/intelligence/retail/support", label: "Support" },
    showUsers && { key: "users", href: "/intelligence/retail/users", label: "Users" },
    showSettings && { key: "settings", href: "/intelligence/retail/settings", label: "Settings" },
    showStockReporting && { key: "stock-reporting", href: "/intelligence/retail/stock-reporting", label: "Stock Sale Reporting" },
  ].filter((x): x is NavItem => Boolean(x));

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!showOrders) return;
    setSearchOpen(false);
    router.push(
      q
        ? `/intelligence/retail/orders?q=${encodeURIComponent(q)}`
        : "/intelligence/retail/orders"
    );
  }

  return (
    <div className="sp">
      <header className="sp-header">
        <div className="sp-header__inner">
          <ModuleSwitcher user={user} current="reports" />

          <FitNav items={navItems} active={active} />

          <div className="sp-header__right">
            {showOrders ? (
              <div ref={searchRef} className="sp-search-wrap">
                <button
                  type="button"
                  className="sp-round"
                  aria-label="Search dealers, orders, reports"
                  aria-expanded={searchOpen}
                  onClick={() => setSearchOpen((v) => !v)}
                >
                  <Search size={16} strokeWidth={2} aria-hidden />
                </button>
                {searchOpen ? (
                  <form className="sp-search" onSubmit={onSearch} role="search">
                    <Search className="sp-search__ico" aria-hidden />
                    <input
                      autoFocus
                      className="sp-search__input"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                      placeholder="Search dealers, orders, reports..."
                      aria-label="Search dealers, orders, reports"
                    />
                  </form>
                ) : null}
              </div>
            ) : null}

            <AccessibilityMenu variant="header" />

            {showMessages ? (
              <Link
                href="/intelligence/retail/messaging"
                className="sp-bell"
                aria-label={
                  notificationCount > 0
                    ? `${notificationCount} notifications`
                    : "Notifications"
                }
              >
                <Bell size={16} strokeWidth={2} />
                {notificationCount > 0 ? (
                  <span className="sp-bell__badge">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <div ref={userRef} className="sp-user-wrap">
              <button
                type="button"
                className="sp-user"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                onClick={() => setUserOpen((v) => !v)}
              >
                <span className="sp-user__avatar">{initials}</span>
                <span className="sp-user__meta">
                  <span className="sp-user__name">{displayName}</span>
                  <span className="sp-user__role">Staff Account</span>
                </span>
                <ChevronDown size={16} strokeWidth={2} aria-hidden />
              </button>
              {userOpen ? (
                <div className="sp-user__menu" role="menu" aria-label="Account">
                  <div className="sp-user__who">
                    <strong>{displayName}</strong>
                    {user.email ? <span>{user.email}</span> : null}
                  </div>
                  <Link
                    href="/intelligence/forgot-password?portal=staff"
                    role="menuitem"
                    onClick={() => setUserOpen(false)}
                  >
                    <KeyRound size={15} aria-hidden />
                    Change password
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: "/access" })}
                  >
                    <LogOut size={15} aria-hidden />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="sp-main">{children}</main>
    </div>
  );
}
