"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Play, Plus, Sparkles } from "lucide-react";
import type { PresentationSlide } from "@/lib/notes";
import { DeckSlide } from "./deck-slide";
import "@/components/note-taker/note-taker-ui.css";

export type DeckRow = { id: string; title: string; createdAt: string; presenter: string | null; theme: string; slides: PresentationSlide[] };
export type WaitingNotes = { id: string; name: string; when: string };

export function DecksHome({ decks, waiting, monthCount }: { decks: DeckRow[]; waiting: WaitingNotes[]; monthCount: number }) {
  const feat = decks[0];
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const count = feat?.slides.length ?? 0;

  useEffect(() => {
    if (hold || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((x) => (x + 1) % count), 3200);
    return () => clearTimeout(t);
  }, [i, hold, count]);

  const newest = waiting[0];
  return (
    <div className="r9">
      <section
        className="tile r9-feat"
        onPointerEnter={() => setHold(true)}
        onPointerLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
      >
        {feat ? (
          <>
            <div className="stories" aria-hidden>
              {feat.slides.map((_, j) => (
                <i key={`${j}-${j === i ? i : "x"}`} className={j < i ? "done" : j === i ? (hold ? "now hold" : "now") : ""} />
              ))}
            </div>
            <div className="r9-s" key={i}>
              <DeckSlide slide={feat.slides[i]} theme={feat.theme} />
            </div>
            <div className="r9-fm">
              <div>
                <span className="eyebrow">Latest deck</span>
                <h1>{feat.title}</h1>
                <small className="muted">
                  {feat.slides.length} slides{feat.presenter ? ` · ${feat.presenter}` : ""} · {format(new Date(feat.createdAt), "d MMM yyyy")}
                </small>
              </div>
              <Link className="btn b" href={`/intelligence/presentations/${feat.id}`}>
                <Play size={16} aria-hidden /> Present
              </Link>
            </div>
          </>
        ) : (
          <div className="r9-empty">
            <span className="eyebrow">Presentations</span>
            <h1>Decks from your meeting notes</h1>
            <p className="muted">Pick finished notes, choose the slides and the look, and present full screen.</p>
            <Link className="btn b" href="/intelligence/presentations/new">
              <Plus size={16} aria-hidden /> Make your first deck
            </Link>
          </div>
        )}
      </section>

      <section className="tile r9-new">
        {newest ? (
          <>
            <img src="/assets2/img/logo-white.svg" alt="" className="t-logo" />
            <span className="eyebrow y">Notes ready · {format(new Date(newest.when), "d MMM")}</span>
            <h3>{newest.name}</h3>
            <p>Turn these notes into a deck.</p>
            <Link className="btn y" href={`/intelligence/presentations/new?from=${newest.id}`}>
              <Sparkles size={16} aria-hidden /> Make the deck
            </Link>
          </>
        ) : (
          <>
            <img src="/assets2/img/logo-white.svg" alt="" className="t-logo" />
            <span className="eyebrow y">All caught up</span>
            <h3>Every finished meeting has a deck</h3>
            <Link className="btn glass" href="/intelligence/note-taker">
              Record a meeting
            </Link>
          </>
        )}
      </section>

      <section className="tile r9-stat">
        <div>
          <b className="big">{monthCount}</b>
          <span>deck{monthCount === 1 ? "" : "s"} this month</span>
        </div>
        <div>
          <b className="big">{decks.reduce((a, d) => a + d.slides.length, 0)}</b>
          <span>slides made for you</span>
        </div>
        <div>
          <b className="big">{waiting.length}</b>
          <span>notes waiting for a deck</span>
        </div>
      </section>

      <section className="tile r9-list">
        <div className="row between">
          <h4>All decks</h4>
          <Link className="btn line sm" href="/intelligence/presentations/new">
            <Plus size={14} aria-hidden /> New deck
          </Link>
        </div>
        {decks.length === 0 ? <p className="muted">No decks yet.</p> : null}
        {decks.map((d) => (
          <div key={d.id} className="li">
            <div className="r9-th">
              <DeckSlide slide={d.slides[0]} theme={d.theme} />
            </div>
            <div>
              <b>{d.title}</b>
              <small>
                {d.slides.length} slides · {format(new Date(d.createdAt), "d MMM yyyy")}
              </small>
            </div>
            <Link className="round sm" href={`/intelligence/presentations/${d.id}`} aria-label={`Present ${d.title}`}>
              <Play size={14} aria-hidden />
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
