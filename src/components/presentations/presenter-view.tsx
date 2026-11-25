"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Maximize2, Minimize2 } from "lucide-react";
import type { PresentationSlide } from "@/lib/notes";
import { formatDuration } from "@/lib/utils";
import { DeckSlide } from "./deck-slide";
import "@/components/note-taker/note-taker-ui.css";

export function PresenterView({ title, slides, theme }: { title: string; slides: PresentationSlide[]; theme: string }) {
  const [i, setI] = useState(0);
  const [sec, setSec] = useState(0);
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    const onFull = () => setFull(document.fullscreenElement === ref.current);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setI((x) => Math.min(last, x + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((x) => Math.max(0, x - 1));
      } else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(last);
    };
    document.addEventListener("fullscreenchange", onFull);
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      document.removeEventListener("fullscreenchange", onFull);
      window.removeEventListener("keydown", onKey);
    };
  }, [last]);

  const toggleFull = () => (document.fullscreenElement ? void document.exitFullscreen() : void ref.current?.requestFullscreen?.());

  if (!slides.length) {
    return (
      <div className="frame dark r3">
        <p>This deck has no slides.</p>
      </div>
    );
  }

  return (
    <div className={`frame dark r3${full ? " is-full" : ""}`} ref={ref}>
      <div className="r3-top">
        {full ? null : (
          <Link href="/intelligence/presentations" className="n2-back">
            <ArrowLeft size={15} aria-hidden /> Presentations
          </Link>
        )}
        <img src="/assets2/img/logo-white.svg" alt="Trinity Energy" className="frame-logo" />
        <b className="r3-title">{title}</b>
        <span className="r3-clock" aria-label="Time presenting">
          <Clock size={15} aria-hidden /> {formatDuration(sec)}
        </span>
        <span aria-live="polite">
          {i + 1} / {slides.length}
        </span>
        <button type="button" className="round light" onClick={toggleFull} aria-label={full ? "Leave full screen" : "Full screen"}>
          {full ? <Minimize2 size={17} aria-hidden /> : <Maximize2 size={17} aria-hidden />}
        </button>
      </div>
      <div className="r3-main">
        <div className="r3-cur" key={i}>
          <DeckSlide slide={slides[i]} theme={theme} n={i + 1} total={slides.length} />
        </div>
        <aside className="r3-side">
          <small>Next</small>
          {slides[i + 1] ? (
            <button type="button" className="r3-next" onClick={() => setI(i + 1)} aria-label={`Next slide: ${slides[i + 1].title}`}>
              <DeckSlide slide={slides[i + 1]} theme={theme} />
            </button>
          ) : (
            <div className="r3-end">End of deck</div>
          )}
          <small>Slides</small>
          <ol className="r3-list">
            {slides.map((s, j) => (
              <li key={j}>
                <button type="button" className={j === i ? "on" : ""} aria-current={j === i ? "true" : undefined} onClick={() => setI(j)}>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <div className="r3-bar">
        <button type="button" className="round light" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous slide">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="dots">
          {slides.map((s, j) => (
            <button key={j} type="button" className={j === i ? "on" : ""} onClick={() => setI(j)} aria-label={`Slide ${j + 1}`} />
          ))}
        </div>
        <button type="button" className="round light" onClick={() => setI(Math.min(last, i + 1))} disabled={i === last} aria-label="Next slide">
          <ChevronRight size={18} aria-hidden />
        </button>
        <small>← → or Space to move</small>
      </div>
    </div>
  );
}
