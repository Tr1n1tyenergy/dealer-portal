"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { destinationLabel, loaderFor, type LoaderKind } from "@/lib/ui/loader-routes";
import { PageLoader, PortalLoader } from "./brand-loaders";

/**
 * Covers the page under the real header from the click until Next commits the next view:
 * the portal orbit when the click opens a different portal or module, the page skeleton otherwise.
 * Hover prefetches are ignored, so resting on a link does not bring the screen up.
 */
type Bridge = { start: () => void; stop: () => void };
let bridge: Bridge | null = null;
let fetchPatched = false;
let historyPatched = false;
const commitListeners = new Set<() => void>();

function headerOffset() {
  const bar = document.querySelector<HTMLElement>(".dp-topbar, .sp-header");
  if (!bar) return 0;
  const bottom = bar.getBoundingClientRect().bottom;
  return bottom > 0 && bottom < 180 ? bottom : 0;
}

function isViewNavigation(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.get("rsc") !== "1") return false;
  if (headers.get("next-router-prefetch") === "1") return false;
  if (headers.get("next-hmr-refresh") === "1") return false;
  const priority = (init as { priority?: string } | undefined)?.priority;
  return priority !== "low";
}

function installFetchWatch() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    if (!isViewNavigation(input, init)) return original(input, init);
    bridge?.start();
    try {
      return await original(input, init);
    } finally {
      bridge?.stop();
    }
  };
}

function installHistoryWatch() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  // Next writes the new address from useInsertionEffect. A setState in that turn
  // is the "useInsertionEffect must not schedule updates" error, so hide runs after it.
  const notify = () => {
    queueMicrotask(() => {
      commitListeners.forEach((listener) => listener());
    });
  };
  window.history.pushState = (data, unused, url) => {
    push(data, unused, url);
    notify();
  };
  window.history.replaceState = (data, unused, url) => {
    replace(data, unused, url);
    notify();
  };
}

function linkChangesView(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function address() {
  return `${window.location.pathname}${window.location.search}`;
}

export function ViewChangeLoader() {
  const [pending, setPending] = useState(false);
  const [top, setTop] = useState(0);
  const [view, setView] = useState<{ kind: LoaderKind; label: string }>({ kind: "page", label: "the page" });

  useEffect(() => {
    let inflight = 0;
    let showing = false;
    let sawFetch = false;
    let from = "";
    let idle = 0;
    let stuck = 0;

    // `target` is where a click is going; fetches and tab switches don't know, so they keep the page skeleton.
    const show = (target?: string) => {
      const wasShowing = showing;
      if (!from) from = address();
      showing = true;
      window.clearTimeout(idle);
      const nextTop = headerOffset();
      flushSync(() => {
        setTop(nextTop);
        if (target) setView({ kind: loaderFor(from, target), label: destinationLabel(target) });
        else if (!wasShowing) setView({ kind: "page", label: destinationLabel(address()) });
        setPending(true);
      });
    };
    const hide = () => {
      showing = false;
      sawFetch = false;
      from = "";
      window.clearTimeout(idle);
      window.clearTimeout(stuck);
      setPending(false);
    };

    bridge = {
      start() {
        inflight += 1;
        sawFetch = true;
        window.clearTimeout(stuck);
        stuck = window.setTimeout(hide, 12000);
        show();
      },
      stop() {
        inflight = Math.max(0, inflight - 1);
      },
    };
    installFetchWatch();
    installHistoryWatch();

    const onCommit = () => {
      if (!showing) return;
      if (sawFetch || address() !== from) hide();
    };
    commitListeners.add(onCommit);

    const armIdle = () => {
      const snapshot = from;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (showing && !sawFetch && inflight === 0 && address() === snapshot) hide();
      }, 450);
    };

    const releaseIfInstant = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (showing && !sawFetch && inflight === 0 && address() === from) hide();
        });
      });
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement && anchor.getAttribute("role") !== "menuitem" && linkChangesView(anchor)) {
        const url = new URL(anchor.href, window.location.href);
        show(`${url.pathname}${url.search}`);
        armIdle();
        return;
      }
      const tab = target?.closest?.('[role="tab"]');
      if (!(tab instanceof HTMLElement)) return;
      if (tab.getAttribute("aria-selected") === "true" || tab.getAttribute("aria-disabled") === "true") return;
      if (tab.closest('[role="dialog"], dialog, [aria-modal="true"]')) return;
      show();
      releaseIfInstant();
    };
    const onPop = () => {
      show();
      armIdle();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      bridge = null;
      commitListeners.delete(onCommit);
      window.clearTimeout(idle);
      window.clearTimeout(stuck);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="bl-overlay" style={{ top }}>
      {view.kind === "portal" ? <PortalLoader label={view.label} /> : <PageLoader label={view.label} />}
    </div>
  );
}
