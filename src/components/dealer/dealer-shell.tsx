"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { cn } from "@/lib/utils";
import { activePrimaryNav, DEALER_PRIMARY_NAV } from "@/lib/dealer/nav";
import { AccountMenu } from "./account-menu";
import { UnreadBell } from "./unread-bell";
import { useQuickSearchShortcut } from "./quick-search";
import type { PayPfiPanelProps } from "./pay-pfi-panel";
import { PayPfiProvider } from "./pay-pfi-context";

export function DealerShell({
  children,
  orgName,
  initials,
  name,
  email,
  unread,
  payPfi,
}: {
  children: React.ReactNode;
  orgName: string;
  initials: string;
  name: string;
  email: string;
  /** Unread messages in the dealer's visible chats. */
  unread: number;
  /** Oldest payable PFI — heroes render the glowing Pay CTA via context. */
  payPfi?: PayPfiPanelProps | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const active = activePrimaryNav(pathname, view);
  const [menuOpen, setMenuOpen] = useState(false);
  useQuickSearchShortcut();

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (q) router.push(`/dealer/orders?q=${encodeURIComponent(q)}`);
  }

  return (
    <PayPfiProvider value={payPfi ?? null}>
      <div className="dp-shell">
        <header className="dp-topbar">
          <div className="dp-topbar__brand">
            <Link href="/dealer/dashboard" className="dp-topbar__logo">
              <TrinityLogo variant="dark" height={32} />
            </Link>
            <span className="dp-topbar__divider" aria-hidden />
            <div className="dp-topbar__title">
              <div className="dp-topbar__kicker">Dealer Portal</div>
              <div className="dp-topbar__sub">Trinity Retail Intelligence</div>
            </div>
          </div>

          <nav className="dp-topnav" aria-label="Dealer portal">
            {DEALER_PRIMARY_NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn("dp-topnav__link", isActive && "is-active")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form className="dp-search" role="search" onSubmit={onSearch}>
            <Search size={16} strokeWidth={2} aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Search orders..."
              aria-label="Search orders"
              data-quick-search="top"
              maxLength={100}
            />
          </form>

          <div className="dp-topbar__actions">
            <UnreadBell initial={unread} />
            <AccountMenu orgName={orgName} initials={initials} name={name} email={email} />
            <button
              type="button"
              className="dp-menu-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>

        {menuOpen ? (
          <div className="dp-mobile-nav" role="dialog" aria-label="Dealer navigation">
            {DEALER_PRIMARY_NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn("dp-mobile-nav__link", isActive && "is-active")}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="dp-mobile-nav__secondary">
              <Link href="/dealer/orders/new" onClick={() => setMenuOpen(false)}>
                Place an order
              </Link>
              <Link href="/dealer/orders?view=payment" onClick={() => setMenuOpen(false)}>
                Payments
              </Link>
              <Link href="/dealer/orders?view=deliveries" onClick={() => setMenuOpen(false)}>
                Deliveries
              </Link>
              <Link href="/dealer/dashboard#stations" onClick={() => setMenuOpen(false)}>
                Stations
              </Link>
            </div>
          </div>
        ) : null}

        <div className="dp-workspace">
          <div className="dp-content">{children}</div>
        </div>
      </div>
    </PayPfiProvider>
  );
}
