"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  ChevronDown,
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
  UserRound,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: Home },
  { href: "/dealer/orders/new", label: "Place Order", icon: ShoppingCart },
  { href: "/dealer/orders", label: "My Orders", icon: Package },
  { href: "/dealer/messaging", label: "Messaging", icon: MessageSquare },
  { href: "/dealer/orders", label: "PFIs & Documents", icon: FileText },
  { href: "/dealer/orders", label: "Payments", icon: CreditCard },
  { href: "/dealer/orders", label: "Deliveries", icon: Truck },
  { href: "/dealer/dashboard#stations", label: "Stations", icon: MapPin },
  { href: "/dealer/dashboard#support", label: "Support", icon: Headphones },
  { href: "/dealer/dashboard", label: "Account", icon: UserRound },
];

export function DealerShell({
  children,
  orgName,
  initials,
}: {
  children: React.ReactNode;
  orgName: string;
  initials: string;
}) {
  const pathname = usePathname();

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

        <label className="dp-search">
          <Search size={16} strokeWidth={2} />
          <input type="search" placeholder="Search orders, PFIs, documents..." />
        </label>

        <div className="dp-topbar__actions">
          <button type="button" className="dp-bell" aria-label="Notifications">
            <Bell size={18} strokeWidth={1.75} />
            <span>3</span>
          </button>

          <button type="button" className="dp-user" aria-label="Account menu">
            <span className="dp-user__avatar">{initials}</span>
            <span className="dp-user__meta">
              <strong>{orgName}</strong>
              <em>Dealer Account</em>
            </span>
            <ChevronDown size={16} strokeWidth={2} />
          </button>

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
              const active =
                item.label === "Dashboard"
                  ? pathname === "/dealer/dashboard"
                  : item.label === "Place Order"
                    ? pathname.startsWith("/dealer/orders/new")
                    : item.label === "My Orders"
                      ? pathname === "/dealer/orders" ||
                        (pathname.startsWith("/dealer/orders/") && !pathname.includes("/new"))
                      : item.label === "Messaging"
                        ? pathname.startsWith("/dealer/messaging")
                        : false;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn("dp-sidebar__link", active && "is-active")}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
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
    </div>
  );
}
