"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { destinationLabel, loaderFor, routeKey, rscTarget, viewHasArrived, type LoaderKind } from "@/lib/ui/loader-routes";
import { contentSignature, contentRoot, splashIsCovering } from "@/lib/ui/loader-content";
import { lockPageBehindLoader } from "@/lib/ui/loader-lock";
import { PageLoader, PortalLoader } from "./brand-loaders";

/**
 * Covers the page from the click until the destination view is on screen.
 * Leaves the instant the URL has moved and the route skeleton is gone — never longer.
 */
type Bridge = { start: (target?: string) => void; stop: () => void };
let bridge: Bridge | null = null;
let fetchPatched = false;

const MAX_WAIT_MS = 8_000;

function keepLoaderChrome(el: HTMLElement) {
  return (
    el.classList.contains("bl-overlay") ||
    el.classList.contains("bl-splash") ||
    el.classList.contains("a11y-menu")
  );
}

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
    bridge?.start(rscTarget(input instanceof Request ? input.url : input, window.location.href));
    return original(input, init);
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

/** True once the URL has left the start page and the destination content is showing. */
function destinationIsLive(from: string, startSignature: string) {
  const here = routeKey(address());
  if (here === routeKey(from)) return false;
  const signature = contentSignature();
  if (signature === "loading") return false;
  // Login/access and other pages without a portal shell.
  if (!signature || !startSignature) return true;
  // Soft nav can update the URL a frame before React swaps the view.
  return signature !== startSignature;
}

export function ViewChangeLoader() {
  const [pending, setPending] = useState(false);
  const [top, setTop] = useState(0);
  const [view, setView] = useState<{ kind: LoaderKind; label: string }>({ kind: "page", label: "the page" });

  useEffect(() => {
    let showing = false;
    let from = "";
    let expected: string | null = null;
    let startSignature = "";
    let startedAt = 0;
    let frames = 0;
    let paintedBeforeWatch = false;
    let raf = 0;
    let unlock: (() => void) | null = null;
    let observer: MutationObserver | null = null;

    const hide = () => {
      showing = false;
      from = "";
      expected = null;
      startSignature = "";
      frames = 0;
      paintedBeforeWatch = false;
      window.cancelAnimationFrame(raf);
      raf = 0;
      observer?.disconnect();
      observer = null;
      unlock?.();
      unlock = null;
      // Drop the overlay in the same turn — no fade that outlasts the destination.
      flushSync(() => setPending(false));
    };

    const shouldHide = () => {
      if (!showing) return false;
      // Welcome splash owns the post-sign-in beat; never stack the orbit/skeleton under it.
      if (splashIsCovering()) return true;
      if (performance.now() - startedAt > MAX_WAIT_MS) return true;

      const here = address();
      const signature = contentSignature();

      if (!expected) {
        if (
          viewHasArrived({
            from,
            expected: null,
            here,
            startSignature,
            signature,
          })
        ) {
          return true;
        }
        if (frames > 2 && signature !== "loading" && signature !== startSignature) return true;
        if (frames > 2 && signature !== "loading" && !startSignature) return true;
        return false;
      }

      if (
        viewHasArrived({
          from,
          expected,
          here,
          startSignature,
          signature,
        })
      ) {
        return true;
      }

      if (destinationIsLive(from, startSignature)) return true;

      if (
        paintedBeforeWatch &&
        signature !== "loading" &&
        routeKey(here) === routeKey(expected) &&
        frames > 1
      ) {
        return true;
      }

      // Expected URL is live and the portal shell has real content (not a skeleton).
      if (
        routeKey(here) === routeKey(expected) &&
        signature !== "loading" &&
        Boolean(contentRoot()) &&
        frames > 0
      ) {
        // If the fingerprint still matches the start page, the old view may still be mounted —
        // destinationIsLive already covers the swap. When start was a login/access empty shell,
        // any non-loading signature on the expected URL is enough.
        if (!startSignature || signature !== startSignature) return true;
      }

      return false;
    };

    const tick = () => {
      if (!showing) return;
      frames += 1;
      if (shouldHide()) {
        hide();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const watchDom = () => {
      observer?.disconnect();
      observer = new MutationObserver(() => {
        if (!showing) return;
        if (shouldHide()) hide();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    const show = (target?: string) => {
      // Sign-in splash covers this navigation; do not mount a second loader underneath.
      if (splashIsCovering()) return;

      if (!showing) {
        from = address();
        startSignature = contentSignature();
        startedAt = performance.now();
        showing = true;
        frames = 0;
      }
      if (target) expected = target;
      const nextTop = headerOffset();
      flushSync(() => {
        setTop(nextTop);
        if (target) {
          const kind = loaderFor(from, target);
          setView({ kind, label: destinationLabel(target, kind) });
        } else if (!expected) {
          setView({ kind: "page", label: destinationLabel(from, "page") });
        }
        setPending(true);
      });
      unlock?.();
      unlock = lockPageBehindLoader(keepLoaderChrome);
      window.cancelAnimationFrame(raf);
      watchDom();
      raf = window.requestAnimationFrame(tick);
    };

    bridge = {
      start(target) {
        if (splashIsCovering()) return;
        show(showing ? undefined : target);
        if (target && !expected) expected = target;
      },
      stop() {
        // The request finishing is not the page appearing. The frame loop decides.
      },
    };
    installFetchWatch();

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement && anchor.getAttribute("role") !== "menuitem" && linkChangesView(anchor)) {
        const url = new URL(anchor.href, window.location.href);
        show(`${url.pathname}${url.search}`);
        return;
      }
      const tab = target?.closest?.('[role="tab"]');
      if (!(tab instanceof HTMLElement)) return;
      if (tab.getAttribute("aria-selected") === "true" || tab.getAttribute("aria-disabled") === "true") return;
      if (tab.closest('[role="dialog"], dialog, [aria-modal="true"]')) return;
      show();
    };
    const onPop = () => {
      paintedBeforeWatch = true;
      show(address());
    };

    // URL can change without a click we saw (router.push). Re-check every navigation.
    const onPath = () => {
      if (!showing) return;
      if (shouldHide()) {
        hide();
        return;
      }
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(tick);
    };

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPath);
    return () => {
      bridge = null;
      unlock?.();
      observer?.disconnect();
      window.cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPath);
    };
  }, []);

  // Keep the page locked for the whole time React has the overlay mounted.
  useEffect(() => {
    if (!pending) return;
    return lockPageBehindLoader(keepLoaderChrome);
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="bl-overlay"
      style={{ top }}
      aria-busy="true"
      onMouseDown={(event) => event.preventDefault()}
    >
      {view.kind === "portal" ? <PortalLoader label={view.label} /> : <PageLoader label={view.label} />}
    </div>
  );
}
