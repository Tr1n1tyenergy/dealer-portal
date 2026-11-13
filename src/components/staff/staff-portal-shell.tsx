"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, ChevronDown, KeyRound, LogOut, Search } from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { canUser, type StaffUser } from "@/lib/permissions";
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
  if (pathname.startsWith("/intelligence/admin/settings")) return "settings";
  if (pathname.startsWith("/intelligence/retail/stock-reporting")) return "stock-reporting";
  if (pathname === "/intelligence/retail" || pathname === "/intelligence/retail/") return "home";
  return "home";
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
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (userRef.current && !userRef.current.contains(t)) setUserOpen(false);
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

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!showOrders) return;
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
          <Link href="/intelligence/retail" className="sp-brand">
            <TrinityLogo variant="dark" height={40} />
            <span className="sp-brand__rule" aria-hidden />
            <span>
              <div className="sp-brand__title">Staff Portal</div>
              <div className="sp-brand__sub">Trinity Retail Intelligence</div>
            </span>
          </Link>

          <nav className="sp-nav" aria-label="Staff Portal">
            <Link
              href="/intelligence/retail"
              className={cn("sp-nav__link", active === "home" && "is-active")}
            >
              Home
            </Link>
            {showOrders ? (
              <Link
                href="/intelligence/retail/orders"
                className={cn("sp-nav__link", active === "orders" && "is-active")}
              >
                Orders
              </Link>
            ) : null}
            {showAnalytics ? (
              <Link
                href="/intelligence/retail/analytics"
                className={cn("sp-nav__link", active === "analytics" && "is-active")}
              >
                Analytics
              </Link>
            ) : null}
            {showMessages ? (
              <Link
                href="/intelligence/retail/messaging"
                className={cn("sp-nav__link", active === "messages" && "is-active")}
              >
                Messages
              </Link>
            ) : null}
            {showSupport ? (
              <Link
                href="/intelligence/retail/support"
                className={cn("sp-nav__link", active === "support" && "is-active")}
              >
                Support
              </Link>
            ) : null}
            {showUsers ? (
              <Link
                href="/intelligence/retail/users"
                className={cn("sp-nav__link", active === "users" && "is-active")}
              >
                Users
              </Link>
            ) : null}
            {showSettings ? (
              <Link
                href="/intelligence/admin/settings"
                className={cn("sp-nav__link", active === "settings" && "is-active")}
              >
                Settings
              </Link>
            ) : null}
            {showStockReporting ? (
              <Link
                href="/intelligence/retail/stock-reporting"
                className={cn("sp-nav__link", active === "stock-reporting" && "is-active")}
              >
                Stock Sale Reporting
              </Link>
            ) : null}
          </nav>

          <div className="sp-header__right">
            <form className="sp-search" onSubmit={onSearch} role="search">
              <Search className="sp-search__ico" aria-hidden />
              <input
                className="sp-search__input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dealers, orders, reports..."
                aria-label="Search dealers, orders, reports"
              />
            </form>

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
