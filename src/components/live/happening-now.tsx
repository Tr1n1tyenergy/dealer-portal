import { formatKes } from "@/lib/orders/money";
import type { FeedEvent } from "@/lib/live/recent-events";
import "./happening-now.css";

const ago = (iso: string, now: number) => {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60e3));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
};

/** The latest order changes, newest first, with the time since and the amount where it matters. */
export function HappeningNow({ events, nowIso }: { events: FeedEvent[]; nowIso: string }) {
  const now = new Date(nowIso).getTime();
  if (events.length === 0) return <p className="rad-feed-empty">No order activity yet.</p>;
  return (
    <ul className="rad-feed">
      {events.map((e, i) => (
        <li key={e.id} className={i === 0 ? "is-new" : undefined}>
          <span className="rad-feed__ago">{ago(e.at, now)}</span>
          <span>{e.text}</span>
          {e.amount ? <b>{formatKes(e.amount)}</b> : <b />}
        </li>
      ))}
    </ul>
  );
}
