"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Captions, Mic, Pause, Play, Square } from "lucide-react";
import "./note-taker-ui.css";

const COUNTDOWN_TOTAL = 20;
const clock = (s: number) =>
  `${s >= 3600 ? `${Math.floor(s / 3600)}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const WARM: [string, string] = ["#ffca05", "#ed1c24"];
const COOL: [string, string] = ["#2dc0d1", "#e6fbfd"]; // cyan into near-white: visible on the blue gradient

function mix([a, b]: [string, string], t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}

/** Ring of bars around the Trinity mark: warm on top, cool below. Follows the microphone when there is one. */
function Radial({ on, analyser }: { on: boolean; analyser: MutableRefObject<AnalyserNode | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(on);
  live.current = on;
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const N = 84;
    const lv = new Array(N).fill(0.05);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      if (cv.width !== Math.round(w * dpr)) cv.width = cv.height = Math.round(w * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, w);
      const an = live.current ? analyser.current : null;
      let fd: Uint8Array<ArrayBuffer> | null = null;
      if (an) {
        fd = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(fd);
      }
      const c = w / 2;
      const r = w * 0.27;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        let target = 0.05;
        if (fd) target = 0.05 + (fd[Math.floor((Math.abs(i - N / 2) / (N / 2)) * fd.length * 0.6)] / 255) * 0.95;
        else if (live.current && !still) target = 0.1 + 0.3 * Math.abs(Math.sin(t / 700 + i * 0.4));
        lv[i] += (target - lv[i]) * 0.18;
        const len = 6 + lv[i] * w * 0.17;
        const down = Math.cos(a + Math.PI / 2);
        ctx.strokeStyle = down < 0 ? mix(WARM, Math.min(1, -down * 1.4)) : mix(COOL, Math.min(1, down * 1.4));
        ctx.lineWidth = Math.max(2, w / 150);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
        ctx.lineTo(c + Math.cos(a) * (r + len), c + Math.sin(a) * (r + len));
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);
  return <canvas ref={ref} className="radial" aria-hidden />;
}

type Session = {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
  scheduledAt: string | null;
  timeLimitSeconds: number | null;
};

export function LiveRecorder({ session, startNow }: { session: Session; startNow?: () => Promise<void> }) {
  const router = useRouter();
  const [status, setStatus] = useState(session.status);
  const [startedAt, setStartedAt] = useState(session.startedAt);
  const [count, setCount] = useState(COUNTDOWN_TOTAL);
  const [countPaused, setCountPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mic, setMic] = useState<"off" | "on" | "blocked">("off");
  const analyser = useRef<AnalyserNode | null>(null);
  const recording = status === "RECORDING" || status === "PAUSED";

  async function act(action: "start" | "pause" | "resume" | "stop") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/note-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError("That didn't go through. Check your connection and try again.");
    setStatus(data.session.status);
    setStartedAt(data.session.startedAt);
    if (action === "stop") router.push(`/intelligence/note-taker/${session.id}/notes`);
    router.refresh();
  }

  // Countdown before recording starts.
  useEffect(() => {
    if (status !== "COUNTDOWN" || countPaused || busy) return;
    if (count <= 0) {
      void act("start");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, count, countPaused]);

  // Timer, and stop at the time limit.
  useEffect(() => {
    if (!recording || !startedAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick(); // also when paused, so the time shows after a reload
    if (status !== "RECORDING") return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status, startedAt, recording]);
  useEffect(() => {
    if (status === "RECORDING" && session.timeLimitSeconds && elapsed >= session.timeLimitSeconds && !busy) void act("stop");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  // Microphone level for the ring while recording.
  useEffect(() => {
    if (!recording) return;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        ctx = new AudioContext();
        const node = ctx.createAnalyser();
        node.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(node);
        analyser.current = node;
        setMic("on");
      } catch {
        setMic("blocked");
      }
    })();
    return () => {
      cancelled = true;
      analyser.current = null;
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close();
    };
  }, [recording]);

  const limit = session.timeLimitSeconds;
  const center =
    status === "COUNTDOWN" ? (
      <b className="n2-count" key={count} aria-live="polite">
        {count}
      </b>
    ) : (
      <img src="/assets2/img/trinity-mark.svg" alt="" className="n2-mark-img" />
    );

  return (
    <div className="frame dark n2-frame">
      <div className="n2">
        <section className="n2-vis">
          <Link href="/intelligence/note-taker" className="n2-back">
            <ArrowLeft size={15} aria-hidden /> Note Taker
          </Link>
          <div className="n2-ring">
            <Radial on={status === "RECORDING" || status === "COUNTDOWN"} analyser={analyser} />
            <span className="n2-mark">{center}</span>
          </div>
          {recording ? <div className="n2-time">{clock(elapsed)}</div> : null}
          <span className={`live${status === "RECORDING" ? "" : " off"}`}>
            {status === "RECORDING" ? "Recording" : status === "PAUSED" ? "Paused" : status === "COUNTDOWN" ? "Starting" : "Scheduled"} · {session.name}
          </span>
          {recording && limit ? (
            <div className="limit" title={`Stops by itself at ${Math.round(limit / 60)} min`}>
              <i style={{ width: `${Math.min(100, (elapsed / limit) * 100)}%` }} />
              <small>{Math.max(0, Math.ceil((limit - elapsed) / 60))} min left</small>
            </div>
          ) : null}
          <div className="row c">
            {status === "SCHEDULED" && startNow ? (
              <form action={startNow}>
                <button type="submit" className="btn y">
                  <Mic size={16} aria-hidden /> Start now
                </button>
              </form>
            ) : null}
            {status === "COUNTDOWN" ? (
              <>
                <button type="button" className="btn y" disabled={busy} onClick={() => void act("start")}>
                  <Mic size={16} aria-hidden /> Start now
                </button>
                <button type="button" className="btn glass" onClick={() => setCountPaused((p) => !p)}>
                  {countPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />} {countPaused ? "Resume" : "Hold"}
                </button>
              </>
            ) : null}
            {recording ? (
              <>
                <button type="button" className="btn glass" disabled={busy} onClick={() => void act(status === "PAUSED" ? "resume" : "pause")}>
                  {status === "PAUSED" ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />} {status === "PAUSED" ? "Resume" : "Pause"}
                </button>
                <button type="button" className="btn red" disabled={busy} onClick={() => void act("stop")}>
                  <Square size={15} aria-hidden /> Stop and write notes
                </button>
              </>
            ) : null}
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
          {recording ? (
            <small className="mic-note">
              {mic === "on" ? "Microphone on: the ring follows the room." : mic === "blocked" ? "Microphone blocked: allow it in the browser to see the level." : "Asking for the microphone…"}
            </small>
          ) : null}
        </section>

        <section className="n2-cap">
          <span className="eyebrow">
            <Captions size={14} aria-hidden /> Live captions
          </span>
          <div className="caps">
            <p className="old">
              {status === "SCHEDULED"
                ? `Scheduled for ${session.scheduledAt ? format(new Date(session.scheduledAt), "EEE d MMM · HH:mm") : "later"}. Start when everyone is in the room.`
                : status === "COUNTDOWN"
                  ? "Recording starts when the count reaches zero."
                  : "Captions will show here once transcription is switched on for the Note Taker."}
            </p>
          </div>
          <div className="n2-next">
            <h4>When you stop</h4>
            <ol>
              <li>The meeting is saved with its length.</li>
              <li>Notes are written: summary, decisions, actions, risks.</li>
              <li>You can tick off actions and turn the notes into a deck.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
