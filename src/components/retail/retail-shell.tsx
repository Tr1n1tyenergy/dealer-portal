"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, MessageSquare, Users } from "lucide-react";
import { canUser, type PermissionModule, type StaffUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import "@/app/intelligence/retail/retail-portal.css";

const nav: { href: string; label: string; icon: typeof BarChart3; module: PermissionModule; match: (p: string) => boolean }[] = [
  {
    href: "/intelligence/retail",
    label: "Analytics",
    icon: BarChart3,
    module: "analytics",
    match: (p: string) => p === "/intelligence/retail" || p === "/intelligence/retail/",
  },
  {
    href: "/intelligence/retail/orders",
    label: "Orders",
    icon: ClipboardList,
    module: "orders",
    match: (p: string) => p.startsWith("/intelligence/retail/orders"),
  },
  {
    href: "/intelligence/retail/users",
    label: "Users",
    icon: Users,
    module: "retailUsers",
    match: (p: string) => p.startsWith("/intelligence/retail/users"),
  },
  {
    href: "/intelligence/retail/messaging",
    label: "Messaging",
    icon: MessageSquare,
    module: "messaging",
    match: (p: string) => p.startsWith("/intelligence/retail/messaging"),
  },
];

export function RetailShell({ user, children }: { user: StaffUser; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="ri-shell" style={{ background: "#0a192f" }}>
      <div className="ri-workspace" style={{ background: "#0a192f" }}>
        <aside className="ri-sidebar">
          <div className="ri-sidebar__brand">
            <div className="ri-sidebar__kicker">Trinity Retail</div>
            <div className="ri-sidebar__title">Retail Interface</div>
          </div>
          <nav className="ri-sidebar__nav" aria-label="Retail Interface">
            {nav.filter((item) => canUser(user, item.module, "view")).map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("ri-sidebar__link", active && "is-active")}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="ri-content" style={{ background: "#0a192f" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
