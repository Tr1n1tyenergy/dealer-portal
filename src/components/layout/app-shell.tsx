"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AccountMenu } from "@/components/layout/account-menu";
import { PortalHeader } from "@/components/layout/portal-header";
import { UnreadBell } from "@/components/layout/unread-bell";
import { canUser } from "@/lib/permissions";
import { activeStaffNav } from "@/lib/ui/header-links";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/access";
import "./app-shell.css";

export function AppShell({
  children,
  fullBleed = false,
}: {
  children: React.ReactNode;
  /** @deprecated Nav links removed from header; prop kept for call-site compatibility */
  activeNav?: string;
  /** No column or padding: the Retail Interface pages lay out their own `.ui-page`. */
  fullBleed?: boolean;
}) {
  const { data } = useSession();
  const pathname = usePathname();
  const initials = `${data?.user?.firstName?.[0] ?? ""}${data?.user?.lastName?.[0] ?? ""}`.toUpperCase() || "TE";
  const displayName =
    [data?.user?.firstName, data?.user?.lastName].filter(Boolean).join(" ") || "User";
  const roleText = data?.user?.role ? roleLabel(data.user.role) : (data?.user?.department ?? "Staff");

  return (
    <div className="tri-shell">

      <PortalHeader
        portal="staff"
        user={data?.user}
        active={activeStaffNav(pathname)}
        actions={
          <>
            {canUser(data?.user, "messaging", "view") ? <UnreadBell initial={0} href="/intelligence/retail/messaging" /> : null}
            <AccountMenu
              title={displayName}
              subtitle={roleText}
              initials={initials}
              name={displayName}
              email={data?.user?.email ?? ""}
              changePasswordHref="/intelligence/forgot-password"
              signOutUrl="/intelligence/login"
            />
          </>
        }
      />

      <main className={cn("tri-main", fullBleed && "tri-main--bleed")}>{children}</main>
    </div>
  );
}
