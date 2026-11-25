"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle, Download, Mic, Presentation, Search, Zap } from "lucide-react";
import type { MeetingNotes } from "@/lib/notes";
import "./note-taker-ui.css";

export type NotesListItem = { id: string; name: string; when: string; minutes: number; ready: boolean };
export type NotesDetail = {
  id: string;
  name: string;
  when: string;
  minutes: number;
  ready: boolean;
  notes: MeetingNotes | null;
  transcript: string | null;
  transcriptReady: boolean;
  deckId: string | null;
};

const TONES = ["#3853a4", "#b2451f", "#1f7a6d", "#7a4fa3", "#a1660b", "#2a6fb0"];
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
function tone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

type Tab = "summary" | "decisions" | "actions" | "risks" | "transcript";

export function NotesReader({
  list,
  current,
  initialTab = "summary",
  canDecks,
}: {
  list: NotesListItem[];
  current: NotesDetail;
  initialTab?: Tab;
  canDecks: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [done, setDone] = useState<number[]>(current.notes?.doneActions ?? []);
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const n = current.notes;
  const people = (n?.attendees ?? []).filter((a) => a && a !== "To be confirmed");
  const shown = list.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const actions = n?.actionItems ?? [];

  async function toggle(i: number) {
    const before = done;
    setDone(done.includes(i) ? done.filter((x) => x !== i) : [...done, i].sort((a, b) => a - b));
    setSaveError("");
    const res = await fetch(`/api/note-sessions/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleAction", index: i }),
    }).catch(() => null);
    if (!res?.ok) {
      setDone(before);
      setSaveError("Couldn't save that tick. Please try again.");
      return;
    }
    setDone((await res.json()).doneActions);
  }

  async function record() {
    setBusy(true);
    const res = await fetch("/api/note-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Instant recording", mode: "instant", participants: [] }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.push(`/intelligence/note-taker/${data.session.id}`);
  }

  const tabs: [Tab, string][] = [
    ["summary", "Summary"],
    ["decisions", "Decisions"],
    ["actions", `Actions (${actions.length})`],
    ["risks", "Risks & opportunities"],
    ["transcript", "Transcript"],
  ];

  let panel: React.ReactNode;
  if (!current.ready || !n) {
    panel = (
      <div className="writing">
        {["90%", "70%", "80%"].map((w) => (
          <div key={w} className="skl" style={{ width: w }} />
        ))}
        <p>The notes for this meeting are still being written. This page fills in when they&apos;re ready.</p>
      </div>
    );
  } else if (tab === "summary") {
    panel = (
      <>
        <p className="lede">{n.summary || n.meetingOverview}</p>
        {n.summary && n.meetingOverview ? <p className="muted">{n.meetingOverview}</p> : null}
        {n.discussionTopics.length ? (
          <>
            <h5>Discussed</h5>
            <ul>
              {n.discussionTopics.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </>
        ) : null}
        {n.followUpTasks.length ? (
          <>
            <h5>Next steps</h5>
            <ul>
              {n.followUpTasks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    );
  } else if (tab === "decisions") {
    panel = n.keyDecisions.length ? (
      <ol className="decs">
        {n.keyDecisions.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ol>
    ) : (
      <p className="muted">No decisions were recorded in this meeting.</p>
    );
  } else if (tab === "actions") {
    panel = actions.length ? (
      <div className="acts">
        {actions.map((a, i) => (
          <label key={i} className={`act${done.includes(i) ? " ok" : ""}`}>
            <input type="checkbox" checked={done.includes(i)} onChange={() => void toggle(i)} />
            <span>{a}</span>
          </label>
        ))}
        <small className="muted">
          {actions.length - done.length} of {actions.length} still open. Ticks are saved.
        </small>
        {saveError ? <p className="err" role="alert">{saveError}</p> : null}
      </div>
    ) : (
      <p className="muted">No action items in this meeting.</p>
    );
  } else if (tab === "risks") {
    panel = (
      <div className="ro">
        <div className="ro-r">
          <h5>
            <AlertTriangle size={15} aria-hidden /> Risks
          </h5>
          {n.risks.length ? n.risks.map((r, i) => <p key={i}>{r}</p>) : <p className="muted">None noted.</p>}
        </div>
        <div className="ro-o">
          <h5>
            <Zap size={15} aria-hidden /> Opportunities
          </h5>
          {n.opportunities.length ? n.opportunities.map((r, i) => <p key={i}>{r}</p>) : <p className="muted">None noted.</p>}
        </div>
      </div>
    );
  } else {
    panel = current.transcriptReady && current.transcript ? (
      <div className="tx">{current.transcript}</div>
    ) : (
      <p className="muted">No transcript yet. Transcripts arrive once transcription is switched on for the Note Taker.</p>
    );
  }

  const jsonHref = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ ...n, doneActions: done }, null, 2))}`;

  return (
    <div className="frame n3">
      <aside className="n3-l" aria-label="Meetings">
        <div className="n3-h">
          <b>Meetings</b>
          <button type="button" className="btn y sm" disabled={busy} onClick={() => void record()}>
            <Mic size={14} aria-hidden /> Record
          </button>
        </div>
        <label className="search">
          <Search size={15} aria-hidden />
          <input placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search meetings" />
        </label>
        <nav className="n3-list">
          {shown.map((x) => (
            <Link
              key={x.id}
              href={`/intelligence/note-taker/${x.id}/notes`}
              className={`n3-i${x.id === current.id ? " on" : ""}`}
              aria-current={x.id === current.id ? "page" : undefined}
            >
              <b>{x.name}</b>
              <small>
                {format(new Date(x.when), "d MMM")} · {x.minutes} min
              </small>
              {x.ready ? null : <span className="tag wait">Writing notes…</span>}
            </Link>
          ))}
          {shown.length === 0 ? <p className="muted">No meetings match “{q}”.</p> : null}
        </nav>
      </aside>

      <section className="n3-r">
        <span className="eyebrow">
          {format(new Date(current.when), "EEE d MMM yyyy · HH:mm")} · {current.minutes} min
        </span>
        <div className="n3-t">
          <h1>{current.name}</h1>
          {people.length ? (
            <span className="stack" aria-label={people.join(", ")}>
              {people.slice(0, 6).map((p) => (
                <span key={p} className="avt" style={{ background: tone(p) }} title={p}>
                  {initials(p)}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel" key={tab} role="tabpanel">
          {panel}
        </div>
        {current.ready && n ? (
          <div className="row foot">
            {canDecks ? (
              current.deckId ? (
                <Link className="btn b" href={`/intelligence/presentations/${current.deckId}`}>
                  <Presentation size={16} aria-hidden /> Open the deck
                </Link>
              ) : (
                <Link className="btn b" href={`/intelligence/presentations/new?from=${current.id}`}>
                  <Presentation size={16} aria-hidden /> Make a deck from these notes
                </Link>
              )
            ) : null}
            <a className="btn line" href={jsonHref} download={`${current.name.replace(/[^\w-]+/g, "-").toLowerCase()}-notes.json`}>
              <Download size={16} aria-hidden /> Download notes
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
