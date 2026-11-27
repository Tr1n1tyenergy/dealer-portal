/**
 * While a brand loader covers the screen, stop the page underneath from taking
 * clicks, focus, or password-manager autofill. The loader itself stays interactive.
 * Re-applies when React replaces body children mid-navigation.
 */
export function lockPageBehindLoader(keep: (el: HTMLElement) => boolean) {
  if (typeof document === "undefined") return () => {};

  const locked = new Set<HTMLElement>();

  const apply = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !keep(active) && !active.closest(".bl-overlay, .bl-splash")) {
      active.blur();
    }
    document.documentElement.setAttribute("data-bl-lock", "1");
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (keep(child)) continue;
      if (child.hasAttribute("data-bl-lock-skip")) continue;
      if (!child.inert) {
        child.inert = true;
        locked.add(child);
      }
    }
  };

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    document.documentElement.removeAttribute("data-bl-lock");
    for (const el of locked) el.inert = false;
    locked.clear();
  };
}
