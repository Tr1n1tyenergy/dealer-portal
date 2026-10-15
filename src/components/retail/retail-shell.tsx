"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, MessageSquare, Users } from "lucide-react";
import { can, type Permission } from "@/lib/access";
import { cn } from "@/lib/utils";
import "@/app/intelligence/retail/retail-portal.css";

const nav: { href: string; label: string; icon: typeof BarChart3; permission: Permission; match: (p: string) => boolean }[] = [
  {
    href: "/intelligence/retail",
    label: "Analytics",
    icon: BarChart3,
    permission: "retail.analytics",
    match: (p: string) => p === "/intelligence/retail" || p === "/intelligence/retail/",
  },
  {
    href: "/intelligence/retail/orders",
    label: "Orders",
    icon: ClipboardList,
    permission: "retail.orders",
    match: (p: string) => p.startsWith("/intelligence/retail/orders"),
  },
  {
    href: "/intelligence/retail/users",
    label: "Users",
    icon: Users,
    permission: "retail.users",
    match: (p: string) => p.startsWith("/intelligence/retail/users"),
  },
  {
    href: "/intelligence/retail/messaging",
    label: "Messaging",
    icon: MessageSquare,
    permission: "retail.messaging",
    match: (p: string) => p.startsWith("/intelligence/retail/messaging"),
  },
];

export function RetailShell({ role, children }: { role: string; children: React.ReactNode }) {
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
            {nav.filter((item) => can(role, item.permission)).map((item) => {
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
