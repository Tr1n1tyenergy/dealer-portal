"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Phone, X } from "lucide-react";
import { PFI_COMPANY } from "@/lib/company/pfi-settings";

const OPEN_EVENT = "dp:open-support";

/** Opens the Support card from anywhere in the dealer portal (sidebar, Place Order). */
export function openSupport() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Trinity's contact details, shown as a small modal. Rendered once by the dealer shell. */
export function SupportCard() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Whatever opened the card (Support / Need help?) gets focus back when it closes.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => {
      openerRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      // Keep Tab inside the card while it is open.
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="dp-support__backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="dp-support" role="dialog" ref={dialogRef} aria-modal="true" aria-labelledby="dp-support-title">
        <div className="dp-support__head">
          <h2 id="dp-support-title">Contact Trinity</h2>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p>Questions about an order, a PFI or a payment? Reach the Trinity team:</p>
        <ul>
          <li>
            <Mail size={16} />
            <a href={`mailto:${PFI_COMPANY.email}`}>{PFI_COMPANY.email}</a>
          </li>
          {PFI_COMPANY.phones.map((phone) => (
            <li key={phone}>
              <Phone size={16} />
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
