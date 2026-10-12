"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/app/intelligence/retail/retail-portal.css";

const nav = [
  {
    href: "/intelligence/retail",
    label: "Analytics",
    icon: BarChart3,
    match: (p: string) => p === "/intelligence/retail" || p === "/intelligence/retail/",
  },
  {
    href: "/intelligence/retail/users",
    label: "Users",
    icon: Users,
    match: (p: string) => p.startsWith("/intelligence/retail/users"),
  },
  {
    href: "/intelligence/retail/messaging",
    label: "Messaging",
    icon: MessageSquare,
    match: (p: string) => p.startsWith("/intelligence/retail/messaging"),
  },
];

export function RetailShell({ children }: { children: React.ReactNode }) {
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
        <div className="ri-content" style={{ background: "#0a192f" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
