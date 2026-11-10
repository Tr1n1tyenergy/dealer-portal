"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The element's current width, so an SVG chart can draw at 1:1 and keep its 13px labels 13px on every screen.
 * `fallback` is used for the server render and the first paint.
 */
export function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
