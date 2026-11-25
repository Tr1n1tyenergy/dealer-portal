"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, Mic, X } from "lucide-react";
import { actionTally } from "@/lib/note-taker/stats";
import { parseJsonObject } from "@/lib/utils";
import type { MeetingNotes } from "@/lib/notes";
import { DeckSlide } from "@/components/presentations/deck-slide";
import "./note-taker-ui.css";

export type NoteSessionRow = {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  notesStatus: string;
  notesJson: string | null;
  createdAt: string;
};

export function sessionHref(s: { id: string; status: string }) {
  return s.status === "COMPLETED" ? `/intelligence/note-taker/${s.id}/notes` : `/intelligence/note-taker/${s.id}`;
}

export function statusTag(s: { status: string; notesStatus: string }) {
  if (s.status === "COMPLETED") return s.notesStatus === "READY" ? ["ok", "Notes ready"] : ["wait", "Writing notes"];
  if (s.status === "RECORDING" || s.status === "PAUSED" || s.status === "COUNTDOWN") return ["rec", "Recording"];
  if (s.status === "CANCELLED") return ["off", "Cancelled"];
  return ["up", "Scheduled"];
}

const minutes = (s: NoteSessionRow) => Math.max(1, Math.round((s.durationSeconds ?? 0) / 60));

/** Light cursor glow on the tiles. */
function spot(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
}

function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <div className="cd">&nbsp;</div>;
  const left = Math.max(0, Math.floor((new Date(at).getTime() - now) / 1000));
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return <div className="cd">{left === 0 ? "Starting now" : `${d ? `${d}d ` : ""}${h}h ${m}m ${s}s`}</div>;
}

export function NoteTakerHome({ sessions, deckCount, canDecks }: { sessions: NoteSessionRow[]; deckCount: number; canDecks: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", time: "" });

  const next = useMemo(
    () =>
      sessions
        .filter((s) => s.status === "SCHEDULED" && s.scheduledAt && new Date(s.scheduledAt).getTime() > Date.now() - 3600_000)
        .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0],
    [sessions],
  );
  const finished = sessions.filter((s) => s.status === "COMPLETED");
  const latest = finished.find((s) => s.notesStatus === "READY");
  const latestNotes = parseJsonObject<MeetingNotes>(latest?.notesJson ?? null);
  const tally = actionTally(finished);
  const R = 30;
  const L = 2 * Math.PI * R;

  async function create(mode: "instant" | "schedule") {
    setError("");
    let scheduledAt: string | undefined;
    if (mode === "schedule") {
      if (!form.date || !form.time) return setError("Pick a date and a time.");
      scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
    }
    setBusy(true);
    const res = await fetch("/api/note-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim() || (mode === "instant" ? "Instant recording" : "Scheduled meeting"),
        mode,
        scheduledAt,
        participants: [],
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Couldn't create the meeting. Please try again.");
    router.push(mode === "instant" ? `/intelligence/note-taker/${data.session.id}` : "/intelligence/note-taker");
    if (mode === "schedule") {
      setScheduling(false);
      setForm({ name: "", date: "", time: "" });
    }
    router.refresh();
  }

  return (
    <div className="n9">
      <section className="tile t-hero" onPointerMove={spot}>
        <div className="t-photo" aria-hidden />
        <div className="t-hero-c">
          <span className="eyebrow y">AI Note Taker</span>
          <h1>Meetings, written up for you</h1>
          <p>Record a meeting and get a summary, decisions and action items.</p>
          <div className="row">
            <button type="button" className="btn y" disabled={busy} onClick={() => void create("instant")}>
              <Mic size={16} aria-hidden /> Start recording
            </button>
            <button type="button" className="btn glass" onClick={() => setScheduling(true)}>
              <CalendarDays size={16} aria-hidden /> Schedule
            </button>
          </div>
          {error && !scheduling ? <p className="err" role="alert">{error}</p> : null}
        </div>
      </section>

      <section className="tile t-next" onPointerMove={spot}>
        <span className="eyebrow">Next meeting</span>
        {next ? (
          <>
            <h3>
              <Link href={`/intelligence/note-taker/${next.id}`}>{next.name}</Link>
            </h3>
            <Countdown at={next.scheduledAt!} />
            <small className="muted">{format(new Date(next.scheduledAt!), "EEE d MMM · HH:mm")}</small>
          </>
        ) : (
          <>
            <h3>Nothing scheduled</h3>
            <p className="muted">Schedule a meeting and it counts down here.</p>
            <button type="button" className="lnk" onClick={() => setScheduling(true)}>
              Schedule a meeting →
            </button>
          </>
        )}
      </section>

      <section className="tile t-act" onPointerMove={spot}>
        <svg viewBox="0 0 80 80" className="nt-ring" aria-hidden>
          <circle cx={40} cy={40} r={R} className="nt-ring-bg" />
          <circle cx={40} cy={40} r={R} className="nt-ring-fg" strokeDasharray={L} strokeDashoffset={tally.total ? L * (1 - tally.open / tally.total) : L} />
        </svg>
        <div>
          <b className="big">{tally.open}</b>
          <span>action item{tally.open === 1 ? "" : "s"} open</span>
          {latest ? (
            <Link className="lnk" href={`/intelligence/note-taker/${latest.id}/notes?tab=actions`}>
              See actions →
            </Link>
          ) : null}
        </div>
      </section>

      {canDecks ? (
        <section className="tile t-deck" onPointerMove={spot}>
          {latest ? (
            <div className="t-deck-s">
              <DeckSlide slide={{ id: "title", title: latest.name, subtitle: format(new Date(latest.startedAt ?? latest.createdAt), "d MMM yyyy"), bullets: [] }} />
            </div>
          ) : null}
          <div>
            <b className="big">{deckCount}</b>
            <span>deck{deckCount === 1 ? "" : "s"} made from notes</span>
            <Link className="lnk" href="/intelligence/presentations">
              Presentations →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="tile t-sum" onPointerMove={spot}>
        {latest ? (
          <>
            <span className="eyebrow">Latest notes · {format(new Date(latest.startedAt ?? latest.createdAt), "d MMM")}</span>
            <h3>{latest.name}</h3>
            <p>{latestNotes?.summary || latestNotes?.meetingOverview || "Notes are ready."}</p>
            <Link className="lnk" href={`/intelligence/note-taker/${latest.id}/notes`}>
              Open notes →
            </Link>
          </>
        ) : (
          <>
            <span className="eyebrow">Latest notes</span>
            <h3>No notes yet</h3>
            <p className="muted">Record your first meeting and its notes appear here.</p>
          </>
        )}
      </section>

      <section className="tile t-list" onPointerMove={spot}>
        <h4>Recent</h4>
        {sessions.length === 0 ? <p className="muted">Nothing recorded yet.</p> : null}
        {sessions.slice(0, 6).map((s) => {
          const [tone, label] = statusTag(s);
          const when = s.startedAt ?? s.scheduledAt ?? s.createdAt;
          return (
            <Link key={s.id} href={sessionHref(s)} className="li">
              <div>
                <b>{s.name}</b>
                <small>
                  {format(new Date(when), "d MMM · HH:mm")}
                  {s.status === "COMPLETED" ? ` · ${minutes(s)} min` : ""}
                </small>
              </div>
              <span className={`tag ${tone}`}>{label}</span>
            </Link>
          );
        })}
      </section>

      {scheduling ? (
        <div className="nt-modal" role="dialog" aria-modal="true" aria-labelledby="sched-title">
          <button type="button" className="nt-modal__bg" aria-label="Close" onClick={() => setScheduling(false)} />
          <form
            className="nt-modal__panel"
            onSubmit={(e) => {
              e.preventDefault();
              void create("schedule");
            }}
          >
            <div className="row between">
              <h2 id="sched-title">Schedule a meeting</h2>
              <button type="button" className="round sm" aria-label="Close" onClick={() => setScheduling(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <label className="field">
              <span>Meeting name</span>
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pricing check-in" maxLength={200} />
            </label>
            <div className="row">
              <label className="field grow">
                <span>Date</span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </label>
              <label className="field grow">
                <span>Time</span>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
              </label>
            </div>
            {error ? <p className="err" role="alert">{error}</p> : null}
            <div className="row end">
              <button type="button" className="btn line" onClick={() => setScheduling(false)}>
                Cancel
              </button>
              <button type="submit" className="btn b" disabled={busy}>
                {busy ? "Saving…" : "Schedule"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
