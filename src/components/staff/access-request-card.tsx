"use client";

import { useState } from "react";

type Area = { key: string; label: string };

/** "Ask an Admin": pick the areas you need and add a note; one request waits at a time. */
export function AccessRequestCard({ areas, pendingSince }: { areas: Area[]; pendingSince: string | null }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">(pendingSince ? "sent" : "idle");
  const [error, setError] = useState("");

  if (state === "sent") return <span className="smh-acct__value">Request sent{pendingSince ? ` ${pendingSince}` : ""} · waiting for an Admin</span>;
  if (areas.length === 0) return <span className="smh-acct__value">You have every area</span>;
  if (!open)
    return (
      <button type="button" className="ui-navlink" onClick={() => setOpen(true)} aria-expanded={false}>
        Ask an Admin
      </button>
    );

  async function send() {
    if (picked.length === 0) return setError("Pick at least one area.");
    setState("sending");
    setError("");
    const res = await fetch("/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: picked, note: note.trim() || undefined }),
    }).catch(() => null);
    if (res?.ok) return setState("sent");
    const data = res ? await res.json().catch(() => ({})) : {};
    setError(typeof data.error === "string" ? data.error : "Couldn't send the request. Please try again.");
    setState("idle");
  }

  return (
    <form
      className="smh-ask"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <fieldset>
        <legend>Which areas do you need?</legend>
        {areas.map((a) => (
          <label key={a.key}>
            <input
              type="checkbox"
              checked={picked.includes(a.key)}
              onChange={() => setPicked((p) => (p.includes(a.key) ? p.filter((k) => k !== a.key) : [...p, a.key]))}
            />
            {a.label}
          </label>
        ))}
      </fieldset>
      <label className="ui-field">
        <span>Why (optional)</span>
        <textarea className="ui-input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? (
        <p className="smh-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="smh-ask__btns">
        <button type="submit" className="ui-btn ui-btn--primary" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
