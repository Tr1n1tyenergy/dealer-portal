"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { IntelligenceBackground } from "@/components/layout/intelligence-background";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/access";
import "./app-shell.css";

export function AppShell({
  children,
  fullBleed = false,
  suppressIntelligenceBackground = false,
}: {
  children: React.ReactNode;
  /** @deprecated Nav links removed from header; prop kept for call-site compatibility */
  activeNav?: string;
  /** Drop tri-main max-width/padding (Retail Interface workspace). */
  fullBleed?: boolean;
  /** Retail Interface uses solid Analytics navy — do not paint the brighter intel glow. */
  suppressIntelligenceBackground?: boolean;
}) {
  const { data } = useSession();
  const initials = `${data?.user?.firstName?.[0] ?? ""}${data?.user?.lastName?.[0] ?? ""}`.toUpperCase() || "TE";
  const displayName =
    [data?.user?.firstName, data?.user?.lastName].filter(Boolean).join(" ") || "User";
  const roleText = data?.user?.role ? roleLabel(data.user.role) : (data?.user?.department ?? "Staff");

  return (
    <div
      className={cn("tri-shell", suppressIntelligenceBackground && "tri-shell--retail-navy")}
      style={suppressIntelligenceBackground ? { background: "#0a192f" } : undefined}
    >
      {suppressIntelligenceBackground ? null : <IntelligenceBackground />}

      <header className="tri-header">
        <div className="tri-header__inner">
          <Link href="/intelligence/dashboard" className="tri-brand">
            <TrinityLogo variant="dark" height={52} className="tri-brand__logo" />
            <div className="tri-divider" aria-hidden />
            <div className="tri-brand__copy">
              <div className="tri-brand__title">Trinity Retail Intelligence</div>
              <div className="tri-brand__sub">Executive Platform</div>
            </div>
          </Link>

          {/* Brand left; search + actions flush right (mockup) */}
          <div className="tri-header__actions">
            <div className="tri-user">
              <div className="tri-user__avatar">{initials}</div>
              <div className="tri-user__meta">
                <div className="tri-user__name">{displayName}</div>
                <div className="tri-user__role">{roleText}</div>
              </div>
            </div>

            <div className="tri-divider" aria-hidden />

            <button
              type="button"
              className="tri-logout"
              aria-label="Logout"
              onClick={() => signOut({ callbackUrl: "/access" })}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className={cn("tri-main", fullBleed && "tri-main--bleed")}>{children}</main>
    </div>
  );
}
