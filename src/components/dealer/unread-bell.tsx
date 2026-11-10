"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const REFRESH_MS = 60_000;

/**
 * The top-bar bell: unread messages, linking to Messaging. The layout's count is only the first
 * value — the shared layout doesn't re-render between pages — so the bell refreshes itself on
 * every page change, when the window regains focus, and once a minute.
 */
export function UnreadBell({ initial }: { initial: number }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/messaging/unread-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: unknown };
        if (!cancelled && typeof data.unread === "number") setUnread(data.unread);
      } catch {
        // Keep the last known count; the next refresh will try again.
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [pathname]);

  return (
    <Link
      href="/dealer/messaging"
      className="dp-bell"
      aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
    >
      <Bell size={18} strokeWidth={1.75} />
      {unread > 0 ? <span>{unread > 99 ? "99+" : unread}</span> : null}
    </Link>
  );
}
