"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { destinationLabel, loaderFor, routeKey, rscTarget, viewHasArrived, type LoaderKind } from "@/lib/ui/loader-routes";
import { PageLoader, PortalLoader } from "./brand-loaders";

/**
 * Covers the page under the real header from the click until the destination
 * view is actually on screen. The overlay stays through the route skeleton
 * and through any moment the previous page is still showing.
 */
type Bridge = { start: (target?: string) => void; stop: () => void };
let bridge: Bridge | null = null;
let fetchPatched = false;

const MAX_WAIT_MS = 20_000;

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

function contentRoot() {
  return document.querySelector<HTMLElement>(".dp-content, .sp-main, .tri-main, main");
}

/** "loading" while a route skeleton is up; otherwise a fingerprint of the current view. */
function contentSignature() {
  const root = contentRoot();
  if (!root) return "";
  if (root.querySelector(".bl-page")) return "loading";
  const heading = root.querySelector("h1, h2")?.textContent?.trim() ?? "";
  return `${heading}|${root.childElementCount}|${root.innerText.length}`;
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

    const hide = () => {
      showing = false;
      from = "";
      expected = null;
      startSignature = "";
      frames = 0;
      paintedBeforeWatch = false;
      window.cancelAnimationFrame(raf);
      setPending(false);
    };

    const tick = () => {
      if (!showing) return;
      if (performance.now() - startedAt > MAX_WAIT_MS) {
        hide();
        return;
      }
      frames += 1;
      const signature = contentSignature();
      // A tab that stays on this page: leave once its panel has drawn, not after a timed guess.
      if (!expected) {
        if (signature !== "loading" && signature !== startSignature) {
          hide();
          return;
        }
        if (frames > 10 && signature !== "loading") {
          hide();
          return;
        }
        raf = window.requestAnimationFrame(tick);
        return;
      }
      if (
        viewHasArrived({
          from,
          expected,
          here: address(),
          startSignature,
          signature,
        })
      ) {
        hide();
        return;
      }
      // Back and forward can paint the page before this watch starts. Leave once that page is the one showing.
      if (
        paintedBeforeWatch &&
        signature !== "loading" &&
        routeKey(address()) === routeKey(expected) &&
        frames > 2
      ) {
        hide();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const show = (target?: string) => {
      if (!showing) {
        from = address();
        startSignature = contentSignature();
        startedAt = performance.now();
        showing = true;
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
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(tick);
    };

    bridge = {
      start(target) {
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

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      bridge = null;
      window.cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
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
