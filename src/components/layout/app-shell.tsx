"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  ChevronDown,
  HelpCircle,
  Lock,
  LogOut,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { IntelligenceBackground } from "@/components/layout/intelligence-background";
import "./app-shell.css";
import "../dashboard/modules.css";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  /** @deprecated Nav links removed from header; prop kept for call-site compatibility */
  activeNav?: string;
}) {
  const { data } = useSession();
  const initials = `${data?.user?.firstName?.[0] ?? ""}${data?.user?.lastName?.[0] ?? ""}`.toUpperCase() || "TE";
  const displayName =
    [data?.user?.firstName, data?.user?.lastName].filter(Boolean).join(" ") || "User";
  const roleLabel =
    data?.user?.role === "SUPER_ADMIN"
      ? "Super Admin"
      : (data?.user?.role ?? data?.user?.department ?? "Staff").replaceAll("_", " ");

  return (
    <div className="tri-shell">
      <IntelligenceBackground />

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
            <label className="tri-search">
              <Search className="h-3.5 w-3.5" aria-hidden />
              <input placeholder="Search anything..." aria-label="Search" />
            </label>

            <div className="tri-divider" aria-hidden />

            <button type="button" className="tri-bell" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="tri-bell__badge">12</span>
            </button>

            <div className="tri-divider" aria-hidden />

            <div className="tri-user">
              <div className="tri-user__avatar">{initials}</div>
              <div className="tri-user__meta">
                <div className="tri-user__name">{displayName}</div>
                <div className="tri-user__role">{roleLabel}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
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

      <main className="tri-main">{children}</main>
    </div>
  );
}

export function ModulesHero() {
  return (
    <div className="mod-hero">
      <div>
        <div className="mod-eyebrow">Modules</div>
        <h1 className="mod-title">Intelligence Modules</h1>
        <p className="mod-copy">
          Choose a module to unlock actionable intelligence for decision-making
          and retail excellence across Trinity Energy.
        </p>
      </div>

      <div className="mod-suite">
        <div className="mod-suite__icon">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="mod-suite__title">Enterprise Intelligence Suite</div>
          <div className="mod-suite__sub">Secure · Private · Executive-grade</div>
        </div>
      </div>
    </div>
  );
}

export function ModulesFooterStrip() {
  return (
    <div className="mod-footer">
      <div className="mod-footer__item">
        <div className="mod-footer__icon">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <div className="mod-footer__title">Secure. Private. Controlled.</div>
          <div className="mod-footer__desc">
            Enterprise-grade safeguards across every TRI workflow and archive.
          </div>
        </div>
      </div>
      <div className="mod-footer__item">
        <div className="mod-footer__icon">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <div className="mod-footer__title">Role-Based Access</div>
          <div className="mod-footer__desc">
            Permissions are provisioned by Super Admin with full auditability.
          </div>
        </div>
      </div>
      <div className="mod-footer__item">
        <div className="mod-footer__icon">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div>
          <div className="mod-footer__title">Need Help?</div>
          <div className="mod-footer__desc">
            Reach Trinity support for onboarding, access, or module guidance.
          </div>
        </div>
      </div>
    </div>
  );
}
