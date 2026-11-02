"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  HelpCircle,
  Lock,
  Shield,
  Sparkles,
} from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { PortalHeader } from "@/components/layout/portal-header";
import { UnreadBell } from "@/components/layout/unread-bell";
import { canUser } from "@/lib/permissions";
import { activeStaffNav } from "@/lib/ui/header-links";
import { IntelligenceBackground } from "@/components/layout/intelligence-background";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/access";
import "./app-shell.css";
import "../dashboard/modules.css";

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
  const pathname = usePathname();
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
            Permissions are provisioned by an Admin with full auditability.
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
