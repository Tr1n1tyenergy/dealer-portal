"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { SPLASH_START_EVENT, takeSplash } from "@/lib/ui/loader-routes";
import "@/styles/century-gothic.css";
import "./brand-loaders.css";

const MIN_MS = 1200;
const MAX_MS = 4000;
const FADE_MS = 450;

/**
 * The brand moment shown once after signing in. PortalLogin marks it and announces it; it stays over the
 * screen while the first portal page loads (at least MIN_MS, never more than MAX_MS). Click or Esc skips it.
 */
export function SignInSplash() {
  const { data } = useSession();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"off" | "on" | "leaving">("off");
  const startedAt = useRef(0);

  // Start: on a sign-in announced by PortalLogin, or on mount after a full reload.
  useEffect(() => {
    const begin = () => {
      if (!takeSplash(window.sessionStorage)) return;
      startedAt.current = performance.now();
      setPhase("on");
    };
    begin();
    window.addEventListener(SPLASH_START_EVENT, begin);
    return () => window.removeEventListener(SPLASH_START_EVENT, begin);
  }, []);

  // Leave: once we're off the login page and the minimum has passed; the cap, a click or Esc end it sooner.
  useEffect(() => {
    if (phase !== "on") return;
    let leaveTimer = 0;
    const leave = () => setPhase("leaving");
    const elapsed = performance.now() - startedAt.current;
    const cap = window.setTimeout(leave, Math.max(0, MAX_MS - elapsed));
    const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!pathname.endsWith("/login")) {
      leaveTimer = window.setTimeout(leave, Math.max(0, (quick ? MIN_MS / 2 : MIN_MS) - elapsed));
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("splash:skip", leave);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(cap);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("splash:skip", leave);
    };
  }, [phase, pathname]);

  // After fading, unmount.
  useEffect(() => {
    if (phase !== "leaving") return;
    const id = window.setTimeout(() => setPhase("off"), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "off") return null;
  const firstName = data?.user?.firstName?.trim();

  return (
    <div
      className={`bl-splash${phase === "leaving" ? " is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      onClick={() => window.dispatchEvent(new Event("splash:skip"))}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative artwork, already sized and compressed */}
      <img className="bl-splash-art" src="/assets2/img/brand/trinity-splash.webp" alt="" width={900} height={900} />
      <div>
        <p className="bl-splash-eyebrow">Trinity Energy</p>
        <p className="bl-splash-title">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
        <p className="bl-splash-sub">Opening your workspace</p>
        <div className="bl-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p className="bl-skip">Click anywhere or press Esc to skip</p>
      </div>
    </div>
  );
}
