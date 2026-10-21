"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CreditCard,
  FileText,
  Headphones,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { cn } from "@/lib/utils";
import { activeDealerNav, type DealerNavKey } from "@/lib/dealer/nav";
import { openSupport, SupportCard } from "./support-card";
import { AccountMenu } from "./account-menu";
import { UnreadBell } from "./unread-bell";
import { useQuickSearchShortcut } from "./quick-search";

const nav: { href: string; label: string; icon: typeof Home; key: DealerNavKey | null }[] = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: Home, key: "dashboard" },
  { href: "/dealer/orders/new", label: "Place Order", icon: ShoppingCart, key: "place-order" },
  { href: "/dealer/orders", label: "My Orders", icon: Package, key: "orders" },
  { href: "/dealer/messaging", label: "Messaging", icon: MessageSquare, key: "messaging" },
  { href: "/dealer/orders?view=documents", label: "PFIs & Documents", icon: FileText, key: "documents" },
  { href: "/dealer/orders?view=payment", label: "Payments", icon: CreditCard, key: "payments" },
  { href: "/dealer/orders?view=deliveries", label: "Deliveries", icon: Truck, key: "deliveries" },
  { href: "/dealer/dashboard#stations", label: "Stations", icon: MapPin, key: null },
];

export function DealerShell({
  children,
  orgName,
  initials,
  name,
  email,
  unread,
}: {
  children: React.ReactNode;
  orgName: string;
  initials: string;
  name: string;
  email: string;
  /** Unread messages in the dealer's visible chats. */
  unread: number;
}) {
  const router = useRouter();
  useQuickSearchShortcut();

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (q) router.push(`/dealer/orders?q=${encodeURIComponent(q)}`);
  }

  const pathname = usePathname();
  const active = activeDealerNav(pathname, useSearchParams().get("view"));

  return (
    <div className="dp-shell">
      <header className="dp-topbar">
        <div className="dp-topbar__brand">
          <Link href="/dealer/dashboard" className="dp-topbar__logo">
            <TrinityLogo variant="dark" height={34} />
          </Link>
          <div className="dp-topbar__title">
            <div className="dp-topbar__kicker">Dealer Portal</div>
            <div className="dp-topbar__sub">Trinity Retail Intelligence</div>
          </div>
        </div>

        <form className="dp-search" role="search" onSubmit={onSearch}>
          <Search size={16} strokeWidth={2} />
          <input
            type="search"
            name="q"
            placeholder="Search orders…"
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
            className="dp-signout"
            onClick={() => signOut({ callbackUrl: "/access" })}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="dp-workspace">
        <aside className="dp-sidebar">
          <nav className="dp-sidebar__nav" aria-label="Dealer portal">
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = item.key !== null && item.key === active;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn("dp-sidebar__link", isActive && "is-active")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button type="button" className="dp-sidebar__link" onClick={openSupport}>
              <Headphones size={18} strokeWidth={1.75} />
              <span>Support</span>
            </button>
          </nav>

          <div className="dp-sidebar__promo">
            <div
              className="dp-sidebar__promo-img"
              style={{ backgroundImage: "url(/assets2/img/dealer/sidebar-truck.jpg)" }}
              role="img"
              aria-label="Trinity fuel tanker"
            />
            <p>Reliable Fuel, Stronger Partners</p>
          </div>
        </aside>

        <div className="dp-content">{children}</div>
      </div>
      <SupportCard />
    </div>
  );
}
