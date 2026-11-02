"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { activeDealerNav } from "@/lib/dealer/nav";
import { PortalHeader } from "@/components/layout/portal-header";
import { AccountMenu } from "@/components/layout/account-menu";
import { UnreadBell } from "@/components/layout/unread-bell";
import { SupportCard } from "./support-card";
import { useQuickSearchShortcut } from "./quick-search";

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

  const active = activeDealerNav(usePathname(), useSearchParams().get("view"));
  const placeOrder = (
    <Link href="/dealer/orders/new" className="ui-btn ui-btn--primary">
      Place an order
    </Link>
  );

  return (
    <div className="dp-shell">
      <PortalHeader
        portal="dealer"
        active={active}
        menuTop={placeOrder}
        actions={
          <>
            <form className="ph-search" role="search" onSubmit={onSearch}>
              <Search size={16} strokeWidth={2} aria-hidden />
              <input type="search" name="q" placeholder="Search orders" aria-label="Search orders" data-quick-search="top" maxLength={100} />
            </form>
            <UnreadBell initial={unread} href="/dealer/messaging" />
            <span className="ph-hide-small">{placeOrder}</span>
            <AccountMenu
              title={orgName}
              subtitle="Dealer account"
              initials={initials}
              name={name}
              email={email}
              changePasswordHref="/intelligence/forgot-password?portal=dealer"
              signOutUrl="/dealer/login"
            />
          </>
        }
      />
      <div className="dp-content">{children}</div>
      <SupportCard />
    </div>
  );
}
