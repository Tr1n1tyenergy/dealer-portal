"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 60_000;

/** Re-renders the server page every minute while the tab is visible, and as soon as it becomes visible. */
export function AnalyticsAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, EVERY_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
  return null;
}
