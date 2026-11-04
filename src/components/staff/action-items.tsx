"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { sessionId: string; meeting: string; when: string; text: string; hash: string };
const key = (i: Item) => `${i.sessionId}:${i.hash}`;

/** The person's open action items. Ticking saves at once; the item drops off Home a few seconds later, with Undo until then. */
export function ActionItems({ items }: { items: Item[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function toggle(item: Item) {
    const k = key(item);
    const ticking = !done.has(k);
    setError("");
    setDone((d) => {
      const n = new Set(d);
      if (ticking) n.add(k);
      else n.delete(k);
      return n;
    });
    const res = await fetch(`/api/note-sessions/${item.sessionId}/actions/done`, {
      method: ticking ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: item.text }),
    }).catch(() => null);
    if (!res?.ok) {
      setDone((d) => {
        const n = new Set(d);
        if (ticking) n.delete(k);
        else n.add(k);
        return n;
      });
      setError("Couldn't save that. Please try again.");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 4000);
  }

  if (items.length === 0) return <p className="smh-empty">No open action items. New ones appear here when your meeting notes are ready.</p>;
  return (
    <>
      <ul className="smh-todo">
        {items.map((i) => {
          const isDone = done.has(key(i));
          return (
            <li key={key(i)} className={isDone ? "is-done" : undefined}>
              <label>
                <input type="checkbox" checked={isDone} onChange={() => void toggle(i)} />
                <span>
                  <span className="smh-todo__text">{i.text}</span>
                  <em>
                    {i.meeting} · {i.when}
                  </em>
                </span>
              </label>
              {isDone ? (
                <button type="button" className="ui-navlink" onClick={() => void toggle(i)}>
                  Undo
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="smh-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="smh-hint">Ticked items are saved and drop off your Home.</p>
      )}
    </>
  );
}
