"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Check, Mic } from "lucide-react";
import { DECK_SECTIONS, generatePresentationSlides, type DeckSection, type MeetingNotes } from "@/lib/notes";
import { DeckSlide } from "./deck-slide";
import "@/components/note-taker/note-taker-ui.css";

export type BuilderNotes = { id: string; name: string; when: string; notes: MeetingNotes };
const LOOKS = [
  ["light", "Light"],
  ["blue", "Blue"],
  ["photo", "Station photo"],
  ["warm", "Warm"],
] as const;
const STEPS = ["Pick notes", "Choose slides", "Presenter and look"];

export function DeckBuilder({ options, from, me }: { options: BuilderNotes[]; from: string | null; me: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mid, setMid] = useState(options.find((o) => o.id === from)?.id ?? options[0]?.id ?? "");
  const [inc, setInc] = useState<DeckSection[]>(DECK_SECTIONS.map(([k]) => k));
  const [presenter, setPresenter] = useState(me);
  const [theme, setTheme] = useState<(typeof LOOKS)[number][0]>("light");
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const m = options.find((o) => o.id === mid);
  const slides = useMemo(
    () =>
      m
        ? generatePresentationSlides({ meetingName: m.name, dateLabel: format(new Date(m.when), "dd MMM yyyy"), presenter: presenter.trim() || me, notes: m.notes, sections: inc })
        : [],
    [m, presenter, me, inc],
  );
  useEffect(() => setCur((c) => Math.min(c, Math.max(0, slides.length - 1))), [slides.length]);

  if (!m) {
    return (
      <div className="frame r2-empty">
        <Link href="/intelligence/presentations" className="n2-back dark">
          <ArrowLeft size={15} aria-hidden /> Presentations
        </Link>
        <h1>No notes ready for a deck</h1>
        <p className="muted">Decks are made from finished meeting notes, and every finished meeting already has one.</p>
        <Link className="btn y" href="/intelligence/note-taker">
          <Mic size={16} aria-hidden /> Record a meeting
        </Link>
      </div>
    );
  }

  const people = [me, ...m.notes.attendees.filter((a) => a && a !== "To be confirmed" && a !== me)];

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteSessionId: mid, presenter: presenter.trim() || me, sections: inc, theme }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.id) return router.push(`/intelligence/presentations/${data.id}`);
    if (!res.ok) {
      setBusy(false);
      return setError(typeof data.error === "string" ? data.error : "Couldn't make the deck. Please try again.");
    }
    router.push(`/intelligence/presentations/${data.presentation.id}`);
    router.refresh();
  }

  let body: React.ReactNode;
  if (step === 0) {
    body = options.map((x) => (
      <button key={x.id} type="button" className={`radio${mid === x.id ? " on" : ""}`} aria-pressed={mid === x.id} onClick={() => setMid(x.id)}>
        <i />
        <span>
          <b>{x.name}</b>
          <small>
            {format(new Date(x.when), "d MMM")} · {x.notes.keyDecisions.length} decision{x.notes.keyDecisions.length === 1 ? "" : "s"} ·{" "}
            {x.notes.actionItems.length} action{x.notes.actionItems.length === 1 ? "" : "s"}
          </small>
        </span>
      </button>
    ));
  } else if (step === 1) {
    body = DECK_SECTIONS.map(([k, label]) => (
      <label key={k} className="switch">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={inc.includes(k)}
          onChange={() => setInc(inc.includes(k) ? inc.filter((x) => x !== k) : DECK_SECTIONS.map(([s]) => s).filter((s) => s === k || inc.includes(s)))}
        />
        <i />
      </label>
    ));
  } else {
    body = (
      <>
        <h5>Presenter</h5>
        <div className="chips">
          {people.map((p) => (
            <button key={p} type="button" className={`chip pick-chip${presenter === p ? " on" : ""}`} aria-pressed={presenter === p} onClick={() => setPresenter(p)}>
              {p}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Or type a name</span>
          <input value={presenter} onChange={(e) => setPresenter(e.target.value)} maxLength={200} />
        </label>
        <h5>Look</h5>
        <div className="themes">
          {LOOKS.map(([k, label]) => (
            <button key={k} type="button" className={`th${theme === k ? " on" : ""}`} aria-pressed={theme === k} onClick={() => setTheme(k)}>
              <DeckSlide slide={slides[0]} theme={k} />
              <small>{label}</small>
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="frame r2">
      <section className="r2-l">
        <Link href="/intelligence/presentations" className="n2-back dark">
          <ArrowLeft size={15} aria-hidden /> Presentations
        </Link>
        <h1>New deck</h1>
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "on" : i < step ? "ok" : ""}>
              <i>{i < step ? <Check size={12} aria-hidden /> : i + 1}</i>
              {s}
            </li>
          ))}
        </ol>
        <div className="r2-body" key={step}>
          {body}
        </div>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="row foot">
          {step ? (
            <button type="button" className="btn line" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} aria-hidden /> Back
            </button>
          ) : null}
          {step < 2 ? (
            <button type="button" className="btn b" onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn y" disabled={busy} onClick={() => void create()}>
              <Check size={16} aria-hidden /> {busy ? "Making the deck…" : "Create deck"}
            </button>
          )}
        </div>
      </section>
      <section className="r2-r" aria-label="Preview">
        <div className="r2-big">
          <DeckSlide slide={slides[cur]} theme={theme} n={cur + 1} total={slides.length} />
        </div>
        <div className="strip">
          {slides.map((s, i) => (
            <button key={s.id} type="button" className={i === cur ? "on" : ""} onClick={() => setCur(i)} aria-label={`Slide ${i + 1}: ${s.title}`}>
              <DeckSlide slide={s} theme={theme} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
