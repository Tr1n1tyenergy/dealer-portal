"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { destinationLabel } from "@/lib/ui/loader-routes";
import "@/styles/century-gothic.css";
import "./brand-loaders.css";

// The three parts of the Trinity mark (viewBox 0 0 70 59), copied from the brand file public/assets2/img/trinity-mark.svg.
const PARTS = {
  stem: "M33.33,21.1s0,0,0,0c-.12.04-.24.07-.36.11h0c-.1.04-.19.07-.29.1-.02,0-.05.02-.07.03-.09.03-.18.07-.27.1-.03,0-.06.02-.09.03-.08.03-.16.07-.24.1-.04.02-.07.03-.11.05-.07.03-.15.07-.22.1-.04.02-.08.04-.12.06-.07.03-.14.07-.2.1-.04.02-.09.04-.13.07-.06.03-.13.07-.19.1-.05.03-.09.05-.14.08-.06.03-.12.07-.18.11-.05.03-.1.06-.14.09-.07.05-.14.09-.21.14-.03.02-.07.05-.11.07-.08.06-.16.11-.24.18-.02.01-.04.03-.06.04-.09.07-.18.14-.26.21-.01,0-.02.02-.03.03-2.61,2.16-4.22,5.99-4.3,12.78v-.07s0,.05,0,.07v-1.23c0,.19-.01.39-.01.59v.4c0,.73,0,1.91,0,2.45,0,10.69,8.67,19.36,19.36,19.36V20.21c-.6,0-1.2,0-1.8,0-3.54,0-6.83.06-9.59.9Z",
  bar: "M39.22.85s-.02,0-.03,0h.03c-4.79.12-8.03,1.82-10.16,4.54-2.74,3.49-3.66,8.66-3.68,14.26v16.06c.09-6.73,1.69-10.55,4.3-12.7.01,0,.02-.02.03-.03.08-.07.17-.14.26-.21.02-.01.04-.03.06-.04.08-.06.16-.12.24-.18.04-.03.07-.05.11-.07.07-.05.14-.09.21-.14.05-.03.09-.06.14-.09.06-.04.12-.07.18-.11.05-.03.09-.05.14-.08.06-.04.13-.07.19-.1.04-.02.09-.05.13-.07.07-.04.14-.07.2-.1.04-.02.08-.04.12-.06.07-.03.14-.07.22-.1.04-.02.07-.03.11-.05.08-.04.16-.07.24-.1.03-.01.06-.02.09-.03.09-.04.18-.07.27-.1.03,0,.05-.02.07-.03.1-.04.19-.07.29-.1h0c.12-.04.24-.08.36-.12,0,0,0,0,0,0,3.22-.98,7.17-.9,11.38-.9h23.65c0-1.42-.15-2.81-.44-4.15-.51-2.35-1.45-4.53-2.73-6.48C61.74,4.32,55.78.85,49.01.85h-9.8Z",
  cap: "M1.7.85c0,2.05.32,4.02.91,5.87,2.49,7.82,9.81,13.49,18.45,13.49h4.31v-.56c.02-5.6.94-10.76,3.68-14.26,2.13-2.71,5.36-4.42,10.14-4.54H1.7Z",
};

/** The Trinity mark drawn inline with its brand gradients (warm petal + stem, cool petal). */
export function TrinityMark({ size = 104, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} width={size} height={(size * 59) / 70} viewBox="0 0 70 59" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffca05" />
          <stop offset=".18" stopColor="#ffca05" />
          <stop offset="1" stopColor="#ed1c24" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffca05" />
          <stop offset=".2" stopColor="#ffca05" />
          <stop offset="1" stopColor="#ed1c24" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3853a4" />
          <stop offset="1" stopColor="#2dc0d1" />
        </linearGradient>
      </defs>
      <path d={PARTS.stem} fill={`url(#${id}s)`} />
      <path d={PARTS.bar} fill={`url(#${id}c)`} />
      <path d={PARTS.cap} fill={`url(#${id}w)`} />
    </svg>
  );
}

/** Everyday page changes: a warm-and-cool line under the header over a grey page skeleton. */
export function PageLoader({ label: given }: { label?: string }) {
  // Route fallbacks (loading.tsx) don't pass a label: name the page from the address being loaded.
  const pathname = usePathname();
  const label = given ?? destinationLabel(pathname ?? "/", "page");
  // A route fallback under the navigation overlay stays silent, so screen readers hear one "Loading …".
  const [underOverlay, setUnderOverlay] = useState(false);
  useEffect(() => {
    if (!given) setUnderOverlay(Boolean(document.querySelector(".bl-overlay")));
  }, [given]);
  const status = underOverlay ? {} : ({ role: "status", "aria-live": "polite", "aria-busy": true } as const);
  return (
    <div className="bl bl-page" {...status}>
      <span className="bl-line" aria-hidden="true" />
      <div className="bl-sk-wrap" aria-hidden="true">
        <div className="bl-sk-label">
          <TrinityMark size={20} /> Loading {label}
        </div>
        <div className="bl-sk bl-sk-hero" />
        <div className="bl-sk-kpis">
          <div className="bl-sk" />
          <div className="bl-sk" />
          <div className="bl-sk" />
          <div className="bl-sk" />
        </div>
        <div className="bl-sk-table">
          <div className="bl-sk" />
          <div className="bl-sk" />
          <div className="bl-sk" />
          <div className="bl-sk" />
          <div className="bl-sk" />
        </div>
      </div>
      {underOverlay ? null : <span className="bl-sr">Loading {label}</span>}
    </div>
  );
}

/** Opening a different portal or module: yellow, red and blue orbit, then merge into the mark. */
export function PortalLoader({ label = "your workspace" }: { label?: string }) {
  return (
    <div className="bl bl-portal" role="status" aria-live="polite" aria-busy="true">
      <div className="bl-orbit" aria-hidden="true">
        <i />
        <i />
        <i />
        <TrinityMark className="bl-orbit-mark" />
      </div>
      <p className="bl-title">Opening {label}</p>
    </div>
  );
}
