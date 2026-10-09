"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/app/intelligence/retail/retail-portal.css";

const nav = [
  { href: "/intelligence/retail", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/intelligence/retail" || p === "/intelligence/retail/" },
  { href: "/intelligence/retail/users", label: "Users", icon: Users, match: (p: string) => p.startsWith("/intelligence/retail/users") },
  { href: "/intelligence/retail/messaging", label: "Messaging", icon: MessageSquare, match: (p: string) => p.startsWith("/intelligence/retail/messaging") },
];

export function RetailShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="ri-shell">
      <div className="ri-workspace">
        <aside className="ri-sidebar">
          <div className="ri-sidebar__brand">
            <div className="ri-sidebar__kicker">Trinity Retail</div>
            <div className="ri-sidebar__title">Retail Interface</div>
          </div>
          <nav className="ri-sidebar__nav" aria-label="Retail Interface">
            {nav.map((item) => {
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
        <div className="ri-content">{children}</div>
      </div>
    </div>
  );
}
