"use client";

import { useEffect } from "react";

/** The search box ⌘K / Ctrl+K focuses: the page's own search if it has one, else the top bar's. */
export function quickSearchTarget(doc: Pick<Document, "querySelector">): HTMLElement | null {
  return (
    doc.querySelector<HTMLElement>('[data-quick-search="page"]') ??
    doc.querySelector<HTMLElement>('[data-quick-search="top"]')
  );
}

/** Binds ⌘K / Ctrl+K to focus the quick search, instead of the browser's own search. */
export function useQuickSearchShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const target = quickSearchTarget(document);
      if (!target) return;
      e.preventDefault();
      target.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
