"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { MODULE_PANEL, splitModules } from "@/lib/modules";
import type { StaffUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import "./module-switcher.css";

/** Header brand that doubles as the way back to the modules page and across to the other modules. */
export function ModuleSwitcher({ user, current }: { user: StaffUser; current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const work = splitModules(user).work;
  const label = MODULE_PANEL[current]?.title ?? work.find((m) => m.id === current)?.title ?? "Retail";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="msw" ref={ref}>
      <button
        type="button"
        className="msw-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: switch module`}
        onClick={() => setOpen((v) => !v)}
      >
        <img src="/assets2/img/logo.png" alt="Trinity Energy" className="msw-logo" />
        <span className="msw-rule" aria-hidden />
        <span className="msw-t">
          <small>Trinity Retail Intelligence</small>
          <b>{label}</b>
        </span>
        <ChevronDown size={15} aria-hidden />
      </button>
      {open ? (
        <div className="msw-menu" role="menu">
          <Link href="/intelligence/dashboard" role="menuitem" className="msw-all" onClick={() => setOpen(false)}>
            <LayoutGrid size={17} aria-hidden />
            <span>
              <b>All modules</b>
              <small>Back to the modules page</small>
            </span>
          </Link>
          {work.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.id}
                href={m.href}
                role="menuitem"
                aria-current={m.id === current ? "page" : undefined}
                className={cn(m.id === current && "is-current")}
                onClick={() => setOpen(false)}
              >
                <Icon size={17} aria-hidden />
                <span>
                  <b>{MODULE_PANEL[m.id]?.title ?? m.title}</b>
                  <small>{MODULE_PANEL[m.id]?.text ?? m.description}</small>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
