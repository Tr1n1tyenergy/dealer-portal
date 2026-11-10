"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";

/** The account button at the right of the header: who is signed in, Change password, Sign out (all portals). */
export function AccountMenu({
  title,
  subtitle,
  initials,
  name,
  email,
  changePasswordHref,
  signOutUrl,
}: {
  /** First line on the button: the dealer company, or the person's name for staff and depot. */
  title: string;
  subtitle: string;
  initials: string;
  name: string;
  email: string;
  changePasswordHref: string;
  signOutUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Menu keyboard: focus the first item on open; arrows move, Home/End jump, Escape closes.
  function onMenuKeyDown(e: React.KeyboardEvent) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? list[0] : list[list.length - 1])?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="ph-account" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ph-user"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ph-user__avatar">{initials}</span>
        <span className="ph-user__meta">
          <strong>{title}</strong>
          <em>{subtitle}</em>
        </span>
        <ChevronDown size={16} strokeWidth={2} />
      </button>

      {open ? (
        <div className="ph-account__menu" role="menu" aria-label="Account" ref={menuRef} onKeyDown={onMenuKeyDown}>
          <div className="ph-account__who">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          <Link href={changePasswordHref} role="menuitem" onClick={() => setOpen(false)}>
            <KeyRound size={15} />
            Change password
          </Link>
          <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: signOutUrl })}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
