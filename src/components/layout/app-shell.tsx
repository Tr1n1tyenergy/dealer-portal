"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  FileSpreadsheet,
  Grid2x2,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  Mic,
  Presentation,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { IntelligenceBackground } from "@/components/layout/intelligence-background";
import { cn } from "@/lib/utils";
import "./app-shell.css";
import "../dashboard/modules.css";

const nav = [
  { href: "/intelligence/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "dashboard" },
  { href: "/intelligence/dashboard", label: "Modules", icon: Grid2x2, match: "modules" },
  { href: "/intelligence/reports", label: "Retail Interface", icon: FileSpreadsheet, match: "reports" },
  { href: "/intelligence/note-taker", label: "AI Note Taker", icon: Mic, match: "note-taker" },
  { href: "/intelligence/presentations", label: "Presentations", icon: Presentation, match: "presentations" },
];

const adminNav = [
  { href: "/intelligence/admin/users", label: "Users", icon: Users, match: "users" },
  { href: "/intelligence/admin/activity", label: "Activity Logs", icon: BarChart3, match: "activity" },
];

function isActive(pathname: string, match: string, label: string) {
  if (label === "Modules") {
    return pathname === "/intelligence/dashboard" || pathname.startsWith("/intelligence/dashboard");
  }
  if (label === "Dashboard") {
    // Modules is the primary dashboard view; keep Dashboard available but Modules owns active state on home
    return false;
  }
  return pathname.includes(match);
}

export function AppShell({
  children,
  activeNav,
}: {
  children: React.ReactNode;
  activeNav?: string;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const isAdmin = data?.user?.role === "SUPER_ADMIN";
  const initials = `${data?.user?.firstName?.[0] ?? ""}${data?.user?.lastName?.[0] ?? ""}`.toUpperCase() || "TE";
  const roleLabel = data?.user?.role === "SUPER_ADMIN" ? "Super Admin" : data?.user?.department;

  const links = [...nav, ...(isAdmin ? adminNav : [])];

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

          <div className="tri-divider" aria-hidden />

          <nav className="tri-nav" aria-label="Primary">
            {links.map((item) => {
              const Icon = item.icon;
              const active =
                activeNav === item.label.toLowerCase() ||
                isActive(pathname, item.match, item.label);
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className={cn("tri-nav__link", active && "is-active")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="tri-header__right">
            <div className="tri-divider" aria-hidden />
            <label className="tri-search">
              <Search className="h-3.5 w-3.5" />
              <input placeholder="Search anything..." aria-label="Search" />
            </label>

            <button type="button" className="tri-bell" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="tri-bell__badge">12</span>
            </button>

            <div className="tri-user">
              <div className="tri-user__avatar">{initials}</div>
              <div className="tri-user__meta">
                <div className="tri-user__name">
                  {data?.user?.firstName} {data?.user?.lastName}
                </div>
                <div className="tri-user__role">{roleLabel}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              <button
                type="button"
                className="tri-logout"
                aria-label="Logout"
                onClick={() => signOut({ callbackUrl: "/access" })}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
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
