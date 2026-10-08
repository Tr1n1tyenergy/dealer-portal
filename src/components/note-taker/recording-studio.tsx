"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  BookmarkPlus,
  Brain,
  Clock,
  FileText,
  Info,
  Lightbulb,
  Lock,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";
import "./recording-countdown.css";
import "./recording-live.css";

const COUNTDOWN_TOTAL = 20;
const CIRCLE_SIZE = 216;
const STROKE = 10;
const RADIUS = (CIRCLE_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const LEVEL_BARS = 64;

type Session = {
  id: string;
  name: string;
  status: string;
  startedAt?: string | null;
  timeLimitSeconds?: number | null;
};

function buildStaticHeights(count: number, seed: number) {
  const vals: number[] = [];
  const viewH = 180;
  const narrowH = 14; // low highs / low lows — tight mid band
  const wideH = viewH - 8; // high highs / low lows — almost full height

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1);

    // Envelope: alternating wide lobes and narrow valleys (like the mockup)
    // Raised power keeps narrow sections truly narrow, wide sections fully open
    const lobes = 3.15 + seed * 0.4;
    const phase = seed * Math.PI * 1.7;
    const raw = 0.5 + 0.5 * Math.sin(t * Math.PI * lobes + phase);
    const envelope = Math.pow(raw, 2.35); // 0 = narrow, 1 = wide

    // Fine static texture inside the current envelope band
    const texture =
      0.55 +
      0.45 *
        Math.abs(Math.sin((t + seed) * Math.PI * 17.4 + i * 0.37)) *
        Math.abs(Math.cos((t + seed) * Math.PI * 9.1 + 1.1));

    const h = narrowH + envelope * (wideH - narrowH) * texture;
    vals.push(Math.max(10, Math.min(wideH, h)));
  }
  return vals;
}

function buildStaticDots(side: "left" | "right") {
  const heights = buildStaticHeights(42, side === "left" ? 0.12 : 0.61);
  const viewH = 180;
  const colGap = 4;
  const startX = 2;
  const pitch = 2.7;
  const r = 0.55;
  const dots: { key: string; x: number; y: number }[] = [];

  heights.forEach((h, i) => {
    const x = startX + i * colGap;
    const top = (viewH - h) / 2;
    const yStart = top + r;
    const yEnd = top + h - r;
    const count = Math.max(0, Math.floor((yEnd - yStart) / pitch) + 1);
    for (let s = 0; s < count; s++) {
      const y = Math.round((yStart + s * pitch) * 100) / 100;
      dots.push({ key: `${i}-${s}`, x, y });
    }
  });

  return dots;
}

function StaticSide({ side }: { side: "left" | "right" }) {
  const dots = useMemo(() => buildStaticDots(side), [side]);
  const viewW = 168;
  const viewH = 180;

  return (
    <svg
      className={`rcd__static rcd__static--${side}`}
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      {dots.map(({ key, x, y }) => (
        <circle key={key} cx={x} cy={y} r={0.55} fill="rgba(90, 165, 255, 0.55)" />
      ))}
    </svg>
  );
}

function buildLiveWaveColumns() {
  const count = 96;
  const viewW = 920;
  const viewH = 160;
  const gap = viewW / count;
  const items: {
    x: number;
    h: number;
    color: string;
    opacity: number;
    delay: number;
  }[] = [];

  const halfCount = Math.floor(count / 2);
  const leftHeights: number[] = [];

  for (let i = 0; i < halfCount; i++) {
    const u = i / Math.max(halfCount - 1, 1);
    const lobes = 2.7;
    const raw = 0.5 + 0.5 * Math.sin(u * Math.PI * lobes + 0.35);
    const envelope = Math.pow(raw, 2.2);
    const narrowH = 14;
    const wideH = viewH - 8;
    const texture =
      0.5 +
      0.5 *
        Math.abs(Math.sin(u * Math.PI * 18.5 + i * 0.41)) *
        Math.abs(Math.cos(u * Math.PI * 11.2 + 0.8));
    leftHeights.push(narrowH + envelope * (wideH - narrowH) * texture);
  }

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const dist = Math.abs(t - 0.5) * 2;
    const leftIndex =
      i < halfCount
        ? i
        : count % 2 === 1 && i === halfCount
          ? halfCount - 1
          : count - 1 - i;
    const h = leftHeights[Math.min(leftIndex, leftHeights.length - 1)];

    let opacity = 1;
    if (dist < 0.11) opacity = 0;
    else if (dist < 0.22) opacity = (dist - 0.11) / 0.11;

    const goldMix = Math.max(0, 1 - dist / 0.48);
    const r = Math.round(30 + (245 - 30) * goldMix);
    const g = Math.round(64 + (158 - 64) * goldMix);
    const b = Math.round(175 + (11 - 175) * goldMix);

    items.push({
      x: gap * i + gap * 0.5,
      h,
      color: `rgb(${r},${g},${b})`,
      opacity,
      delay: (leftIndex % 10) * 0.07,
    });
  }

  return { items, viewW, viewH };
}

function buildLiveWaveDots(columns: ReturnType<typeof buildLiveWaveColumns>) {
  const pitch = 2.55;
  const dotR = 0.9;
  const groups: {
    key: string;
    delay: number;
    dots: { key: string; x: number; y: number; color: string; opacity: number }[];
  }[] = [];

  columns.items.forEach((col, i) => {
    if (col.opacity <= 0.02) return;
    const top = (columns.viewH - col.h) / 2;
    const yStart = top + dotR;
    const yEnd = top + col.h - dotR;
    const count = Math.max(0, Math.floor((yEnd - yStart) / pitch) + 1);
    const dots: { key: string; x: number; y: number; color: string; opacity: number }[] = [];

    for (let s = 0; s < count; s++) {
      const y = Math.round((yStart + s * pitch) * 100) / 100;
      dots.push({
        key: `${i}-${s}`,
        x: col.x,
        y,
        color: col.color,
        opacity: col.opacity,
      });
    }

    groups.push({ key: `col-${i}`, delay: col.delay, dots });
  });

  return groups;
}

function LiveStaticWave({ paused }: { paused: boolean }) {
  const columns = useMemo(() => buildLiveWaveColumns(), []);
  const groups = useMemo(() => buildLiveWaveDots(columns), [columns]);

  return (
    <div
      className="rlive__wave"
      aria-hidden
      style={{ opacity: paused ? 0.55 : 1 }}
    >
      <svg viewBox={`0 0 ${columns.viewW} ${columns.viewH}`} preserveAspectRatio="none">
        {groups.map((group) => (
          <g
            key={group.key}
            className="rlive__wave-col"
            style={{
              animationPlayState: paused ? "paused" : "running",
              animationDelay: `${group.delay}s`,
            }}
          >
            {group.dots.map((dot) => (
              <circle
                key={dot.key}
                cx={dot.x}
                cy={dot.y}
                r={0.9}
                fill={dot.color}
                opacity={dot.opacity}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

function CountdownScreen({
  sessionName,
  countdown,
  paused,
  busy,
  onTogglePause,
  onCancel,
}: {
  sessionName: string;
  countdown: number;
  paused: boolean;
  busy: boolean;
  onTogglePause: () => void;
  onCancel: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const progress = (COUNTDOWN_TOTAL - countdown) / COUNTDOWN_TOTAL;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="rcd">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tri-main:has(.rcd) {
              max-width: 980px !important;
              padding: 2rem 1.5rem 2.75rem !important;
            }
            .rcd__card {
              background: linear-gradient(165deg, rgba(13, 55, 125, 0.82) 0%, rgba(8, 36, 92, 0.88) 42%, rgba(4, 18, 52, 0.92) 100%) !important;
              border: 1px solid rgba(115, 165, 255, 0.38) !important;
              border-radius: 1.35rem !important;
              box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 0 0 1px rgba(55, 130, 255, 0.12), 0 28px 72px rgba(0, 8, 28, 0.55), 0 0 48px rgba(35, 100, 220, 0.12) !important;
              backdrop-filter: blur(18px) !important;
              -webkit-backdrop-filter: blur(18px) !important;
              overflow: hidden !important;
            }
            .rcd__dev-pause {
              background: rgba(6, 24, 62, 0.88) !important;
              border: 1px solid rgba(115, 165, 255, 0.38) !important;
              color: rgba(210, 225, 248, 0.92) !important;
            }
            .rcd__title { color: #ffffff !important; }
            .rcd__subtitle { color: rgba(186, 205, 235, 0.72) !important; }
            .rcd__circle { background: transparent !important; }
            .rcd__count { color: #ffffff !important; }
            .rcd__count-label { color: rgba(186, 205, 235, 0.75) !important; }
            .rcd__feature-icon {
              background: rgba(55, 130, 255, 0.16) !important;
              border: 1px solid rgba(115, 165, 255, 0.28) !important;
              color: #ffffff !important;
            }
            .rcd__feature-title { color: #ffffff !important; }
            .rcd__feature-desc { color: rgba(186, 205, 235, 0.62) !important; }
            .rcd__feature-rule { background: rgba(115, 165, 255, 0.22) !important; }
            .rcd__meta {
              background: rgba(2, 10, 30, 0.62) !important;
              border: 1px solid rgba(115, 165, 255, 0.16) !important;
              border-radius: 1rem !important;
              margin: 0 1.25rem 1.25rem !important;
              padding: 0.85rem 0.35rem !important;
            }
            .rcd__meta-label { color: rgba(186, 205, 235, 0.55) !important; }
            .rcd__meta-value { color: #ffffff !important; }
            .rcd__meta-value svg { color: #7eb8ff !important; }
            .rcd__meta-rule { background: rgba(115, 165, 255, 0.22) !important; }
            .rcd__cancel {
              background: rgba(6, 24, 62, 0.72) !important;
              border: 1px solid rgba(115, 165, 255, 0.42) !important;
              color: #ffffff !important;
            }
            .rcd__hint { color: rgba(186, 205, 235, 0.5) !important; }
          `,
        }}
      />
      <div className="rcd__card">
        <div className="rcd__hero">
          <button
            type="button"
            className="rcd__dev-pause"
            onClick={onTogglePause}
            title={paused ? "Resume countdown" : "Pause countdown"}
            aria-label={paused ? "Resume countdown" : "Pause countdown"}
          >
            {paused ? (
              <Play size={12} fill="currentColor" strokeWidth={0} />
            ) : (
              <Pause size={12} fill="currentColor" strokeWidth={0} />
            )}
            <span>{paused ? "Resume" : "Pause"}</span>
          </button>

          <div className="rcd__mic-wrap" aria-hidden>
            <span className="rcd__ring rcd__ring--3" />
            <span className="rcd__ring rcd__ring--2" />
            <span className="rcd__ring" />
            <span className="rcd__mic">
              <Mic size={18} color="#F5B800" strokeWidth={2.25} />
            </span>
          </div>

          <h1 className="rcd__title">Recording begins in</h1>
          <p className="rcd__subtitle">
            {paused
              ? "Countdown paused — resume when you’re ready."
              : "Get ready. Your session will start automatically."}
          </p>

          <div className="rcd__timer-wrap">
            <StaticSide side="left" />
            <div className="rcd__circle">
              <svg viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`} aria-hidden>
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="rgba(100, 150, 220, 0.22)"
                  strokeWidth={STROKE}
                />
                <circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="#4DA3FF"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                  style={{ transition: "stroke-dashoffset 0.85s linear" }}
                />
                {(() => {
                  const angle = -Math.PI / 2 + progress * Math.PI * 2;
                  const tipX = Math.round((CIRCLE_SIZE / 2 + RADIUS * Math.cos(angle)) * 100) / 100;
                  const tipY = Math.round((CIRCLE_SIZE / 2 + RADIUS * Math.sin(angle)) * 100) / 100;
                  return (
                    <circle
                      cx={tipX}
                      cy={tipY}
                      r="6"
                      fill="#F5B800"
                      style={{ transition: "cx 0.85s linear, cy 0.85s linear" }}
                    />
                  );
                })()}
              </svg>
              <div className="rcd__circle-inner">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={countdown}
                    className="rcd__count"
                    initial={{ scale: 0.72, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.12, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    {countdown}
                  </motion.div>
                </AnimatePresence>
                <div className="rcd__count-label">seconds</div>
                <div className="rcd__eq" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
            <StaticSide side="right" />
          </div>
        </div>

        <div className="rcd__features">
          <div className="rcd__feature">
            <span className="rcd__feature-icon">
              <AudioLines size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="rcd__feature-title">High Quality Audio</div>
              <div className="rcd__feature-desc">
                Capturing in HD for clearer transcripts.
              </div>
            </div>
          </div>
          <span className="rcd__feature-rule" aria-hidden />
          <div className="rcd__feature">
            <span className="rcd__feature-icon">
              <ShieldCheck size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="rcd__feature-title">Secure Recording</div>
              <div className="rcd__feature-desc">
                Your data is encrypted and stored securely.
              </div>
            </div>
          </div>
          <span className="rcd__feature-rule" aria-hidden />
          <div className="rcd__feature">
            <span className="rcd__feature-icon">
              <FileText size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="rcd__feature-title">AI Note Generation</div>
              <div className="rcd__feature-desc">
                Structured notes will be ready after the session.
              </div>
            </div>
          </div>
        </div>

        <div className="rcd__meta">
          <div className="rcd__meta-item">
            <div className="rcd__meta-label">Recording Session</div>
            <div className="rcd__meta-value">
              <span className="rcd__dot" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sessionName || "Instant Recording"}
              </span>
            </div>
          </div>
          <span className="rcd__meta-rule" aria-hidden />
          <div className="rcd__meta-item">
            <div className="rcd__meta-label">Time</div>
            <div className="rcd__meta-value">
              <Clock size={14} strokeWidth={2.25} />
              <span>
                {format(now, "h:mm a")} · {format(now, "d MMM yyyy")}
              </span>
            </div>
          </div>
          <span className="rcd__meta-rule" aria-hidden />
          <div className="rcd__meta-item">
            <div className="rcd__meta-label">Audio Source</div>
            <div className="rcd__meta-value">
              <AudioLines size={14} strokeWidth={2.25} />
              <span>System Microphone</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="rcd__cancel"
        disabled={busy}
        onClick={onCancel}
      >
        <X size={15} strokeWidth={2.5} />
        Cancel Recording
      </button>
      <p className="rcd__hint">You can cancel anytime before the recording starts.</p>
    </div>
  );
}

export function RecordingStudio({ session }: { session: Session }) {
  const router = useRouter();
  const [status, setStatus] = useState(session.status);
  const [countdown, setCountdown] = useState(COUNTDOWN_TOTAL);
  const [countdownPaused, setCountdownPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_BARS).fill(0.04));
  const [signalGood, setSignalGood] = useState(false);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const startedAtMs = useMemo(
    () => (session.startedAt ? new Date(session.startedAt).getTime() : Date.now()),
    [session.startedAt]
  );

  useEffect(() => {
    if (status !== "COUNTDOWN" || countdownPaused) return;
    if (countdown <= 0) {
      void runAction("start");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, countdown, countdownPaused]);

  useEffect(() => {
    if (status !== "RECORDING") return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [status, startedAtMs]);

  // Live mic levels — soft idle pulse + max sensitivity to faintest sound
  useEffect(() => {
    if (status !== "RECORDING" && status !== "PAUSED") {
      setLevels(Array(LEVEL_BARS).fill(0.04));
      setSignalGood(false);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    const smooth = new Array(LEVEL_BARS).fill(0.05);
    const t0 = performance.now();

    // Very soft / low idle — barely visible so real sound spikes hard
    const idlePulse = (now: number, i: number) => {
      const mid = (LEVEL_BARS - 1) / 2;
      const dist = Math.abs(i - mid) / mid;
      const envelope = Math.pow(1 - dist, 1.25);
      const wave =
        0.6 + 0.4 * Math.sin(now * 0.0022 + i * 0.16) * Math.sin(now * 0.0015 + 0.5);
      return (0.028 + 0.032 * wave) * (0.4 + envelope * 0.6);
    };

    async function startMic() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AudioCtx();
        if (ctx.state === "suspended") await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        const preGain = ctx.createGain();
        // As high as practical before analyser (max sensitivity)
        preGain.gain.value = 32;

        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.12;
        analyser.minDecibels = -100;
        analyser.maxDecibels = -25;

        source.connect(preGain);
        preGain.connect(analyser);

        const freq = new Uint8Array(analyser.frequencyBinCount);
        const time = new Uint8Array(analyser.fftSize);

        const tick = () => {
          if (cancelled || !analyser) return;
          const now = performance.now() - t0;

          if (statusRef.current === "PAUSED") {
            for (let i = 0; i < LEVEL_BARS; i++) {
              const idle = idlePulse(now, i);
              smooth[i] = smooth[i] * 0.92 + idle * 0.08;
            }
            setLevels([...smooth]);
            setSignalGood(false);
            raf = requestAnimationFrame(tick);
            return;
          }

          analyser.getByteTimeDomainData(time);
          let sum = 0;
          let peak = 0;
          for (let i = 0; i < time.length; i++) {
            const v = Math.abs((time[i] - 128) / 128);
            sum += v * v;
            if (v > peak) peak = v;
          }
          const rms = Math.sqrt(sum / time.length);

          analyser.getByteFrequencyData(freq);
          let freqAvg = 0;
          let freqPeak = 0;
          const usable = Math.floor(freq.length * 0.55);
          for (let i = 0; i < usable; i++) {
            const f = freq[i] / 255;
            freqAvg += f;
            if (f > freqPeak) freqPeak = f;
          }
          freqAvg /= usable;

          // Maximum sensitivity — faintest distant audio still spikes
          const raw = Math.max(rms * 22, peak * 9, freqAvg * 4.5, freqPeak * 2.2);
          const intensity = Math.min(1, Math.pow(Math.max(0, raw), 0.32) * 1.55);
          const energy = Math.min(1, intensity * 1.55);

          // Tiny idle base; sound multiplies dramatically for contrast
          const pulseScale = 1 + energy * 9;
          const floorBoost = energy * 0.55;

          for (let i = 0; i < LEVEL_BARS; i++) {
            const mid = (LEVEL_BARS - 1) / 2;
            const dist = Math.abs(i - mid) / mid;
            const envelope = Math.pow(1 - dist, 1.05);
            const bin = Math.min(usable - 1, Math.floor((i / LEVEL_BARS) * usable));
            const freqVal = Math.pow(freq[bin] / 255, 0.32);

            const idle = idlePulse(now, i);
            const driven =
              idle * pulseScale +
              floorBoost * envelope +
              energy * envelope * (0.55 + freqVal * 0.7);

            const target = Math.max(0.03, Math.min(1, driven));
            const rise = target > smooth[i] ? 0.82 : 0.18;
            smooth[i] = smooth[i] * (1 - rise) + target * rise;
          }

          setLevels([...smooth]);
          setSignalGood(energy > 0.045);
          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      } catch {
        // Mic denied — still show very soft idle pulse
        const fallback = () => {
          if (cancelled) return;
          const now = performance.now() - t0;
          for (let i = 0; i < LEVEL_BARS; i++) smooth[i] = idlePulse(now, i);
          setLevels([...smooth]);
          setSignalGood(false);
          raf = requestAnimationFrame(fallback);
        };
        raf = requestAnimationFrame(fallback);
      }
    }

    void startMic();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close();
    };
  }, [status]);

  async function runAction(action: "start" | "pause" | "resume" | "stop") {
    setBusy(true);
    const res = await fetch(`/api/note-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return;

    setStatus(data.session.status);
    if (action === "stop") {
      router.push(`/intelligence/note-taker/${session.id}/notes`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  function cancelCountdown() {
    router.push("/intelligence/note-taker");
  }

  if (status === "COUNTDOWN") {
    return (
      <CountdownScreen
        sessionName={session.name}
        countdown={countdown}
        paused={countdownPaused}
        busy={busy}
        onTogglePause={() => setCountdownPaused((p) => !p)}
        onCancel={cancelCountdown}
      />
    );
  }

  const timerLabel = formatDuration(elapsed);
  const isPaused = status === "PAUSED";

  return (
    <div className="rlive">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tri-main:has(.rlive) {
              max-width: 980px !important;
              padding: 2rem 1.5rem 2.75rem !important;
            }
            .rlive__card {
              background: linear-gradient(165deg, rgba(13, 55, 125, 0.82) 0%, rgba(8, 36, 92, 0.88) 42%, rgba(4, 18, 52, 0.92) 100%) !important;
              border: 1px solid rgba(115, 165, 255, 0.38) !important;
              border-radius: 1.35rem !important;
              box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 0 0 1px rgba(55, 130, 255, 0.12), 0 28px 72px rgba(0, 8, 28, 0.55), 0 0 48px rgba(35, 100, 220, 0.12) !important;
              backdrop-filter: blur(18px) !important;
              -webkit-backdrop-filter: blur(18px) !important;
            }
            .rlive__title { color: #ffffff !important; }
            .rlive__subtitle { color: rgba(186, 205, 235, 0.72) !important; }
            .rlive__timer-label { color: rgba(186, 205, 235, 0.55) !important; }
            .rlive__timer { color: #ffffff !important; }
            .rlive__strip {
              background: rgba(2, 10, 30, 0.62) !important;
              border: 1px solid rgba(115, 165, 255, 0.16) !important;
            }
            .rlive__strip-title { color: #ffffff !important; }
            .rlive__strip-desc { color: rgba(186, 205, 235, 0.62) !important; }
            .rlive__strip-icon {
              background: rgba(55, 130, 255, 0.16) !important;
              border: 1px solid rgba(115, 165, 255, 0.28) !important;
              color: #7eb8ff !important;
            }
            .rlive__levels {
              background: rgba(2, 10, 30, 0.62) !important;
              border: 1px solid rgba(115, 165, 255, 0.16) !important;
            }
            .rlive__levels-label { color: rgba(186, 205, 235, 0.55) !important; }
            .rlive__btn--ghost {
              background: rgba(6, 24, 62, 0.72) !important;
              border: 1px solid rgba(115, 165, 255, 0.42) !important;
              color: #ffffff !important;
            }
            .rlive__tip {
              background: rgba(6, 24, 62, 0.72) !important;
              border: 1px solid rgba(115, 165, 255, 0.35) !important;
              color: rgba(186, 205, 235, 0.72) !important;
            }
          `,
        }}
      />
      <div className="rlive__card">
        <div className="rlive__head">
          <div>
            <div className="rlive__live">
              <span className="rlive__live-dot" />
              {isPaused ? "Paused" : "Live Recording"}
            </div>
            <h1 className="rlive__title">{session.name || "Instant Recording"}</h1>
            <p className="rlive__subtitle">Your session is being recorded securely</p>
          </div>
          <div className="rlive__timer-wrap">
            <div className="rlive__timer-label">Elapsed Time</div>
            <div className="rlive__timer">{timerLabel}</div>
            <div className="rlive__hd">HD High Quality</div>
          </div>
        </div>

        <div className="rlive__wave-area">
          <LiveStaticWave paused={isPaused} />
          <div className="rlive__mic-wrap" aria-hidden>
            <span className="rlive__mic-ring rlive__mic-ring--4" />
            <span className="rlive__mic-ring rlive__mic-ring--3" />
            <span className="rlive__mic-ring rlive__mic-ring--2" />
            <span className="rlive__mic-ring" />
            <span className="rlive__mic">
              <Mic size={28} color="#F5B800" strokeWidth={2.2} />
            </span>
          </div>
        </div>

        <div className="rlive__strip">
          <div className="rlive__strip-item">
            <span className="rlive__strip-icon">
              <Mic size={18} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rlive__strip-title">System Microphone</div>
              <div className="rlive__strip-desc">
                <span className="rlive__strip-dot" />
                Active
              </div>
            </div>
          </div>
          <span className="rlive__strip-rule" aria-hidden />
          <div className="rlive__strip-item">
            <span className="rlive__strip-icon">
              <AudioLines size={18} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rlive__strip-title">High Definition Audio</div>
              <div className="rlive__strip-desc">48kHz · Stereo</div>
            </div>
          </div>
          <span className="rlive__strip-rule" aria-hidden />
          <div className="rlive__strip-item">
            <span className="rlive__strip-icon">
              <Brain size={18} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rlive__strip-title">Live transcription</div>
              <div className="rlive__strip-desc">
                <span className="rlive__strip-dot" />
                Enabled
              </div>
            </div>
          </div>
          <span className="rlive__strip-rule" aria-hidden />
          <div className="rlive__strip-item">
            <span className="rlive__strip-icon">
              <Lock size={18} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rlive__strip-title">Encrypted & Secure</div>
              <div className="rlive__strip-desc">Real-time backup</div>
            </div>
          </div>
          <span className="rlive__strip-rule" aria-hidden />
          <div className="rlive__strip-item">
            <span className="rlive__strip-icon">
              <Clock size={18} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rlive__strip-title">Instant Recording</div>
              <div className="rlive__strip-desc">Started just now</div>
            </div>
          </div>
        </div>

        <div className="rlive__levels">
          <div className="rlive__levels-head">
            <div className="rlive__levels-label">
              Audio Levels
              <Info size={13} strokeWidth={2.2} />
            </div>
            <div className={`rlive__signal ${signalGood ? "rlive__signal--good" : ""}`}>
              <span className="rlive__signal-dot" />
              {signalGood ? "Good Signal" : "Low Signal"}
            </div>
          </div>
          <div className="rlive__levels-bars" aria-hidden>
            {levels.map((level, i) => {
              const mid = (LEVEL_BARS - 1) / 2;
              const dist = Math.abs(i - mid) / mid;
              const active = level > 0.09 && dist < 0.78;
              const h = Math.max(4, Math.round(level * 52));
              return (
                <span
                  key={i}
                  className={`rlive__level-bar ${active ? "rlive__level-bar--active" : ""}`}
                  style={{ height: `${h}px` }}
                />
              );
            })}
          </div>
        </div>

        <div className="rlive__actions">
          {isPaused ? (
            <button
              type="button"
              className="rlive__btn rlive__btn--ghost"
              disabled={busy}
              onClick={() => runAction("resume")}
            >
              <Play size={16} fill="currentColor" strokeWidth={0} />
              Resume
            </button>
          ) : (
            <button
              type="button"
              className="rlive__btn rlive__btn--ghost"
              disabled={busy}
              onClick={() => runAction("pause")}
            >
              <Pause size={16} fill="currentColor" strokeWidth={0} />
              Pause
            </button>
          )}
          <button
            type="button"
            className="rlive__btn rlive__btn--stop"
            disabled={busy}
            onClick={() => runAction("stop")}
          >
            <Square size={14} fill="currentColor" strokeWidth={0} />
            Stop Recording
          </button>
          <button type="button" className="rlive__btn rlive__btn--ghost" disabled={busy}>
            <BookmarkPlus size={16} strokeWidth={2.2} />
            Add Marker
          </button>
        </div>
      </div>

      <div className="rlive__tip">
        <Lightbulb size={15} strokeWidth={2.2} />
        Tip: Speak clearly and keep the microphone close for best results.
      </div>
    </div>
  );
}
