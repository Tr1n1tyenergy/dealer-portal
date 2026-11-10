"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getPusherClient } from "@/lib/pusher/client";
import { throttle } from "@/lib/live/throttle";

const nairobiTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });

/**
 * Keeps a server-rendered dashboard current: re-renders on "order-changed" (at most every 5 s) and every 60 s
 * while the tab is visible. The badge says Live when the real-time channel is connected, else when it last updated.
 */
export function LiveRefresh({ channel }: { channel: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [updated, setUpdated] = useState(() => new Date());
  const refresh = useMemo(
    () =>
      throttle(() => {
        router.refresh();
        setUpdated(new Date());
      }, 5000),
    [router],
  );

  useEffect(() => {
    const pusher = getPusherClient();
    const sub = pusher?.subscribe(channel);
    sub?.bind("pusher:subscription_succeeded", () => setConnected(true));
    sub?.bind("pusher:subscription_error", () => setConnected(false));
    sub?.bind("order-changed", refresh);
    const tick = setInterval(() => document.visibilityState === "visible" && refresh(), 60_000);
    return () => {
      clearInterval(tick);
      sub?.unbind("order-changed", refresh);
      pusher?.unsubscribe(channel);
    };
  }, [channel, refresh]);

  return (
    <span className={`ui-live${connected ? " is-on" : ""}`} role="status" aria-live="polite">
      {connected ? "Live" : `Updated ${nairobiTime(updated)}`}
    </span>
  );
}
