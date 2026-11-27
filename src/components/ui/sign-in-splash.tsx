"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { CircleCheck, Layers, Shield } from "lucide-react";
import { SPLASH_START_EVENT, takeSplash } from "@/lib/ui/loader-routes";
import { contentSignature, destinationContentReady } from "@/lib/ui/loader-content";
import { lockPageBehindLoader } from "@/lib/ui/loader-lock";
import "./sign-in-splash.css";

/** Safety net only — real dismissal is the destination view becoming ready. */
const MAX_MS = 8_000;

const STAGES = [
  { id: "data", label: "Loading data", Icon: Layers },
  { id: "setup", label: "Setting things up", Icon: Shield },
  { id: "ready", label: "Almost ready", Icon: CircleCheck },
] as const;

function keepSplashChrome(el: HTMLElement) {
  return (
    el.classList.contains("bl-splash") ||
    el.classList.contains("bl-overlay") ||
    el.classList.contains("a11y-menu")
  );
}

/**
 * The brand moment shown once after signing in. PortalLogin marks it and announces it; it covers
 * the login form while the first portal page loads, and leaves the instant that page is showing.
 * Pass `preview` for a sticky local demo (e.g. /dev/welcome-splash).
 */
export function SignInSplash({ preview = false }: { preview?: boolean }) {
  const { data } = useSession();
  const pathname = usePathname();
  const [on, setOn] = useState(preview);
  const [stage, setStage] = useState(0);
  const [nameWidth, setNameWidth] = useState(160);
  const startedAt = useRef(0);
  const fromPath = useRef("");
  const nameRef = useRef<HTMLSpanElement>(null);

  // Start: on a sign-in announced by PortalLogin, or on mount after a full reload.
  useEffect(() => {
    if (preview) return;
    const begin = () => {
      if (!takeSplash(window.sessionStorage)) return;
      startedAt.current = performance.now();
      fromPath.current = `${window.location.pathname}${window.location.search}`;
      setStage(0);
      setOn(true);
    };
    begin();
    window.addEventListener(SPLASH_START_EVENT, begin);
    return () => window.removeEventListener(SPLASH_START_EVENT, begin);
  }, [preview]);

  // Leave the instant the destination view is live — never a frame longer.
  useEffect(() => {
    if (!on || preview) return;

    const leave = () => {
      setOn(false);
    };

    const ready = () => {
      if (performance.now() - startedAt.current > MAX_MS) return true;
      const path = pathname ?? "";
      // Still on a login screen — destination has not landed yet.
      if (path.endsWith("/login")) return false;
      // Prefer real destination content; empty fingerprint still counts once we left login
      // (login/access shells), matching ViewChangeLoader arrival rules.
      if (destinationContentReady(fromPath.current)) return true;
      const signature = contentSignature();
      return signature !== "loading" && !path.endsWith("/login");
    };

    if (ready()) {
      leave();
      return;
    }

    let raf = 0;
    const tick = () => {
      if (ready()) {
        leave();
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    const observer = new MutationObserver(() => {
      if (ready()) leave();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
    };
    const onSkip = () => leave();
    window.addEventListener("keydown", onKey);
    window.addEventListener("splash:skip", onSkip);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("splash:skip", onSkip);
    };
  }, [on, pathname, preview]);

  useEffect(() => {
    if (!on || preview) return;
    return lockPageBehindLoader(keepSplashChrome);
  }, [on, preview]);

  // Soft stage highlight while waiting — not a claim that work finished.
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => {
      setStage((current) => {
        if (preview) return (current + 1) % STAGES.length;
        return Math.min(current + 1, STAGES.length - 1);
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [on, preview]);

  useLayoutEffect(() => {
    if (!on || !nameRef.current) return;
    const measure = () => setNameWidth(Math.max(96, Math.ceil(nameRef.current!.getBoundingClientRect().width)));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(nameRef.current);
    return () => observer?.disconnect();
  }, [on, data?.user?.firstName, preview]);

  if (!on) return null;
  const firstName = preview ? "Super" : data?.user?.firstName?.trim() || "there";
  const underlineW = Math.max(120, nameWidth + 12);
  const underlineH = Math.round(underlineW * 0.12);

  return (
    <div
      className="bl-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      onClick={preview ? undefined : () => window.dispatchEvent(new Event("splash:skip"))}
      onMouseDown={preview ? undefined : (event) => event.preventDefault()}
    >
      <div className="bl-splash__frame">
        <div className="bl-splash__art-col" aria-hidden="true">
          <div className="bl-splash__art-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand artwork */}
            <img
              className="bl-splash-art"
              src="/assets2/img/brand/trinity-splash.webp"
              alt=""
              width={900}
              height={900}
            />
            <span className="bl-splash__shadow" />
          </div>
        </div>

        <div className="bl-splash__copy">
          <p className="bl-splash__brand">
            <span>Trinity Retail Intelligence</span>
            <i className="bl-splash__brand-line" aria-hidden="true" />
          </p>

          <div className="bl-splash__hello">
            <p className="bl-splash__welcome">Welcome back,</p>
            <p className="bl-splash__name">
              <span ref={nameRef}>{firstName}</span>
              <svg
                className="bl-splash__underline"
                viewBox={`0 0 ${underlineW} ${underlineH}`}
                width={underlineW}
                height={underlineH}
                aria-hidden="true"
              >
                <path
                  d={`M ${underlineW * 0.02} ${underlineH * 0.72} C ${underlineW * 0.28} ${underlineH * 0.18}, ${underlineW * 0.72} ${underlineH * 0.18}, ${underlineW * 0.98} ${underlineH * 0.72}`}
                  fill="none"
                  stroke="#FFCC00"
                  strokeWidth="6"
                  strokeLinecap="round"
                  pathLength="1"
                />
              </svg>
            </p>
          </div>

          <p className="bl-splash__sub">Preparing your workspace...</p>

          <div className="bl-splash__progress" aria-hidden="true">
            <span className="bl-splash__progress-bar" />
          </div>

          <ul className="bl-splash__stages" aria-hidden="true">
            {STAGES.map((item, index) => {
              const Icon = item.Icon;
              const state = index < stage ? "is-done" : index === stage ? "is-active" : "is-next";
              return (
                <li key={item.id} className={`bl-splash__stage ${state}`}>
                  {index > 0 ? <span className="bl-splash__stage-rule" aria-hidden="true" /> : null}
                  <Icon size={22} strokeWidth={1.85} aria-hidden="true" />
                  <span>{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <span className="bl-sr">Preparing your workspace</span>
    </div>
  );
}
