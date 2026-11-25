"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { ModuleSwitcher } from "@/components/staff/module-switcher";
import { AccessibilityMenu } from "@/components/a11y/accessibility-menu";
import type { StaffUser } from "@/lib/permissions";
import "@/styles/century-gothic.css";
import "./module-shell.css";

/** Light header for the AI Note Taker and Presentations modules, matching the Retail staff header. */
export function ModuleShell({
  user,
  current,
  children,
}: {
  user: StaffUser & { firstName?: string | null; lastName?: string | null };
  current: "note-taker" | "presentations";
  children: React.ReactNode;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Staff";
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "TE";
  return (
    <div className="msh">
      <header className="msh-head">
        <div className="msh-inner">
          <ModuleSwitcher user={user} current={current} />
          <div className="msh-right">
            <AccessibilityMenu variant="header" />
            <span className="msh-who">
              <span className="msh-av" aria-hidden>
                {initials}
              </span>
              <span className="msh-name">{name}</span>
            </span>
            <button type="button" className="msh-out" aria-label="Sign out" onClick={() => signOut({ callbackUrl: "/access" })}>
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <main className="msh-main ntx">{children}</main>
    </div>
  );
}
