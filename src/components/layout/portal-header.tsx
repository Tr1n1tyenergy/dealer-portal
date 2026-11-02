"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { openSupport } from "@/components/dealer/support-card";
import type { StaffUser } from "@/lib/permissions";
import { headerLinks, type HeaderGroup, type HeaderLink } from "@/lib/ui/header-links";
import "./portal-header.css";

type Portal = "dealer" | "staff" | "depot";
const HOME: Record<Portal, string> = { dealer: "/dealer/dashboard", staff: "/intelligence/dashboard", depot: "/depot/dashboard" };

/**
 * The one header for all portals (redesign spec §4): logo, menu words in brand blue with the yellow
 * underline, and the portal's own controls on the right. Below 1024px the words move into a Menu sheet.
 */
export function PortalHeader({
  portal,
  user,
  active,
  actions,
  menuTop,
}: {
  portal: Portal;
  user?: StaffUser;
  /** Key of the current page's menu word, if any. */
  active: string | null;
  /** Right-hand controls: search, bell, Place an order, account. */
  actions: ReactNode;
  /** Shown first in the phone/tablet Menu sheet (the dealer's Place an order). */
  menuTop?: ReactNode;
}) {
  const items = headerLinks(portal, user);
  const [sheet, setSheet] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheet) return;
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  function close() {
    setSheet(false);
    menuButton.current?.focus();
  }

  return (
    <header className="ph">
      <div className="ph__bar">
        <Link href={HOME[portal]} className="ph__logo" aria-label="Trinity home">
          <TrinityLogo variant="dark" height={30} />
        </Link>
        <nav className="ph__nav" aria-label="Main">
          {items.map((item) =>
            "links" in item ? (
              <AdminMenu key={item.key} group={item} active={active} />
            ) : (
              <MenuWord key={item.key} link={item} active={active} />
            ),
          )}
        </nav>
        <div className="ph__actions">{actions}</div>
        <button
          ref={menuButton}
          type="button"
          className="ph__menu-button"
          aria-expanded={sheet}
          aria-controls="ph-sheet"
          onClick={() => setSheet(true)}
        >
          Menu
        </button>
      </div>

      {sheet ? (
        <div id="ph-sheet" className="ph-sheet" role="dialog" aria-modal="true" aria-label="Menu" ref={sheetRef}>
          <div className="ph-sheet__head">
            <TrinityLogo variant="dark" height={26} />
            <button type="button" className="ui-btn ui-btn--quiet" onClick={close}>
              Close
            </button>
          </div>
          {menuTop ? <div className="ph-sheet__top" onClick={() => setSheet(false)}>{menuTop}</div> : null}
          <nav aria-label="Main">
            {items.flatMap((item) => ("links" in item ? item.links : [item])).map((link) => (
              <MenuWord key={link.key} link={link} active={active} onPick={() => setSheet(false)} />
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function MenuWord({ link, active, onPick }: { link: HeaderLink; active: string | null; onPick?: () => void }) {
  if (link.href === "#support") {
    return (
      <button type="button" className="ui-navlink ph__word" onClick={() => (onPick?.(), openSupport())}>
        {link.label}
      </button>
    );
  }
  return (
    <Link href={link.href} className="ui-navlink ph__word" aria-current={link.key === active ? "page" : undefined} onClick={onPick}>
      {link.label}
    </Link>
  );
}

function AdminMenu({ group, active }: { group: HeaderGroup; active: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = group.links.some((l) => l.key === active);
  return (
    <div className="ph-group" ref={root}>
      <button
        type="button"
        className="ui-navlink ph__word"
        aria-expanded={open}
        aria-current={current ? "page" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {group.label} ▾
      </button>
      {open ? (
        <div className="ph-group__list">
          {group.links.map((link) => (
            <MenuWord key={link.key} link={link} active={active} onPick={() => setOpen(false)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
