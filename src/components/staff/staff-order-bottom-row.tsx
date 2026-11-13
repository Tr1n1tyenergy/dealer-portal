"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Two-column detail block:
 * - Left (main) sets the total height (Details/Dealer + Payment Summary).
 * - Right (side) matches that height so Order Activity sits under Documents
 *   and its base lines up with Payment Summary; activity list scrolls inside.
 */
export function StaffOrderDetailGrid({
  main,
  side,
}: {
  main: ReactNode;
  side: ReactNode;
}) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const sync = () => {
      const next = Math.round(el.getBoundingClientRect().height);
      setHeight((prev) => (prev === next ? prev : next));
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <div className="sod-grid">
      <div className="sod-col sod-col--main" ref={mainRef}>
        {main}
      </div>
      <div
        className="sod-col sod-col--side"
        style={height != null ? { height } : undefined}
      >
        {side}
      </div>
    </div>
  );
}
