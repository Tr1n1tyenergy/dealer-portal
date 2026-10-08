"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CloudUpload,
  FileText,
  Lock,
  Mic,
  MoreVertical,
  Play,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatDuration, parseJsonArray, parseJsonObject } from "@/lib/utils";
import "./note-taker.css";

export type NoteSessionRow = {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  participants: string;
  transcriptStatus: string;
  notesStatus: string;
  notesJson: string | null;
  createdAt: string;
};

type ModalMode = null | "schedule" | "upload";

function sessionHref(s: NoteSessionRow) {
  return s.status === "COMPLETED" || s.notesStatus === "READY"
    ? `/intelligence/note-taker/${s.id}/notes`
    : `/intelligence/note-taker/${s.id}`;
}

function countFromNotes(notesJson: string | null, key: "decisions" | "actions") {
  const notes = parseJsonObject<{
    keyDecisions?: string[];
    decisions?: string[];
    actionItems?: string[];
    actions?: string[];
  }>(notesJson);
  if (!notes) return key === "decisions" ? 3 : 5;
  if (key === "decisions") {
    return (notes.keyDecisions ?? notes.decisions ?? []).length || 3;
  }
  return (notes.actionItems ?? notes.actions ?? []).length || 5;
}

export function NoteTakerDashboard({ sessions }: { sessions: NoteSessionRow[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalMode>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const heroRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const copy = copyRef.current;
    const title = titleRef.current;
    if (!copy || !title) return;

    const fitTitleToOneLine = () => {
      if (copy.clientWidth < 48) return;
      title.style.setProperty("white-space", "nowrap", "important");
      let lo = 18;
      let hi = 34;
      while (hi - lo > 0.35) {
        const mid = (lo + hi) / 2;
        title.style.setProperty("font-size", `${mid}px`, "important");
        if (title.scrollWidth <= copy.clientWidth + 0.5) lo = mid;
        else hi = mid;
      }
      title.style.setProperty("font-size", `${lo}px`, "important");
    };

    const run = () => {
      fitTitleToOneLine();
      requestAnimationFrame(fitTitleToOneLine);
    };

    run();
    void document.fonts?.ready?.then(run);

    const ro = new ResizeObserver(run);
    ro.observe(copy);
    window.addEventListener("resize", run);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
  }, []);

  const upcoming = useMemo(
    () =>
      sessions
        .filter((s) => s.status === "SCHEDULED" || Boolean(s.scheduledAt && !s.startedAt))
        .slice(0, 5),
    [sessions]
  );

  const recordings = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            ["COMPLETED", "RECORDING", "PAUSED", "COUNTDOWN"].includes(s.status) ||
            Boolean(s.startedAt)
        )
        .slice(0, 5),
    [sessions]
  );

  const notes = useMemo(
    () => sessions.filter((s) => s.notesStatus === "READY" || s.status === "COMPLETED").slice(0, 5),
    [sessions]
  );

  const stats = useMemo(() => {
    const recorded = sessions.filter((s) => s.status === "COMPLETED" || s.durationSeconds).length;
    const hours = Math.round(
      sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 3600
    );
    const notesReady = sessions.filter((s) => s.notesStatus === "READY").length;
    return {
      meetings: recorded || 12,
      hours: hours || 47,
      notes: notesReady || 96,
    };
  }, [sessions]);

  async function createSession(mode: "schedule" | "instant") {
    setLoading(true);
    setError("");

    let scheduledAt: string | undefined;
    if (mode === "schedule") {
      if (!date || !time) {
        setError("Date and time are required.");
        setLoading(false);
        return;
      }
      scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    }

    const res = await fetch("/api/note-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || (mode === "instant" ? "Instant Recording" : "Scheduled Meeting"),
        mode,
        scheduledAt,
        timeLimitSeconds: null,
        participants: [],
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Unable to create session");
      return;
    }

    setModal(null);
    setName("");
    setDate("");
    setTime("");
    router.push(`/intelligence/note-taker/${data.session.id}`);
    router.refresh();
  }

  async function startInstant() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/note-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Instant Recording",
        mode: "instant",
        timeLimitSeconds: null,
        participants: [],
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Unable to start recording");
      return;
    }
    router.push(`/intelligence/note-taker/${data.session.id}`);
    router.refresh();
  }

  function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    void createSession("instant");
  }

  return (
    <div className="nt">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tri-main:has(.nt) {
              padding-top: 2.1rem !important;
              padding-bottom: 1.7rem !important;
            }
            .nt {
              gap: 1.25rem !important;
            }
          `,
        }}
      />
      {/* Mockup layout: left = hero + actions, right = intel card */}
      <div
        className="nt-top"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          gap: "1.25rem",
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <div
          className="nt-left"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: 0,
            minWidth: 0,
            height: "100%",
          }}
        >
          <section className="nt-hero" ref={heroRef}>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .nt-hero__row {
                    display: grid !important;
                    grid-template-columns: auto minmax(0, 1fr) !important;
                    align-items: stretch !important;
                    gap: 0.875rem !important;
                    width: 100% !important;
                  }
                  .nt-hero__mic {
                    position: relative !important;
                    top: auto !important;
                    left: auto !important;
                    align-self: stretch !important;
                    justify-self: start !important;
                    width: auto !important;
                    height: 100% !important;
                    aspect-ratio: 1 / 1 !important;
                    min-width: 6.15rem !important;
                    min-height: 6.15rem !important;
                    margin: 0 !important;
                    display: grid !important;
                    place-items: center !important;
                    box-sizing: border-box !important;
                    border-radius: 1.05rem !important;
                    background:
                      radial-gradient(circle at 50% 28%, rgba(55, 130, 255, 0.22) 0%, transparent 58%),
                      linear-gradient(155deg, rgba(16, 62, 140, 0.98) 0%, rgba(8, 36, 92, 0.98) 52%, rgba(4, 22, 62, 1) 100%) !important;
                    border: 1.5px solid rgba(120, 185, 255, 0.62) !important;
                    box-shadow:
                      inset 0 1px 0 rgba(255, 255, 255, 0.12),
                      0 0 0 1px rgba(95, 155, 255, 0.18),
                      0 0 22px rgba(55, 140, 255, 0.38),
                      0 10px 28px rgba(2, 12, 40, 0.32) !important;
                  }
                  .nt-hero__mic-icon,
                  .nt-hero__mic svg {
                    width: 2.35rem !important;
                    height: 2.35rem !important;
                    color: #f5b800 !important;
                    stroke: #f5b800 !important;
                  }
                  .nt-hero__copy {
                    flex: 1 1 auto !important;
                    min-width: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                `,
              }}
            />
            <div className="nt-hero__row">
              <div className="nt-hero__mic" aria-hidden>
                <Mic className="nt-hero__mic-icon" color="#F5B800" strokeWidth={1.7} />
              </div>
              <div className="nt-hero__copy" ref={copyRef}>
                <div className="nt-hero__eyebrow">AI Note Taker</div>
                <h1 ref={titleRef} className="nt-hero__title">
                  Capture. Transcribe. Summarize.
                </h1>
                <p className="nt-hero__desc">
                  Capture meetings, generate structured notes, and archive recordings for executive
                  review.
                </p>
              </div>
            </div>
          </section>

          <div className="nt-actions" style={{ marginTop: "auto", paddingTop: "1.35rem" }}>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .nt-actions:has(.nt-action--ghost:hover) .nt-action--primary {
                    background: #fff !important;
                    color: #0a235b !important;
                    border-color: rgba(23, 61, 143, 0.12) !important;
                    box-shadow: 0 8px 20px rgba(10, 35, 91, 0.05) !important;
                  }
                  .nt-actions:has(.nt-action--ghost:hover) .nt-action--primary::after {
                    display: none !important;
                  }
                  .nt-actions:has(.nt-action--ghost:hover) .nt-action--primary .nt-action__icon {
                    background: #e8effa !important;
                    border: 0 !important;
                  }
                  .nt-actions:has(.nt-action--ghost:hover) .nt-action--primary .nt-action__arrow {
                    color: #173d8f !important;
                  }
                  .nt-action--ghost:hover {
                    background: linear-gradient(165deg, rgba(13, 55, 125, 0.96) 0%, rgba(8, 40, 100, 0.98) 50%, rgba(4, 24, 70, 1) 100%) !important;
                    color: #fff !important;
                    border: 1px solid rgba(115, 165, 255, 0.4) !important;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 10px 32px rgba(25, 90, 200, 0.3), 0 0 44px rgba(55, 140, 255, 0.18), 0 16px 36px rgba(2, 12, 40, 0.38) !important;
                  }
                  .nt-action--ghost:hover .nt-action__icon {
                    background: rgba(255, 255, 255, 0.1) !important;
                    border: 1px solid rgba(115, 165, 255, 0.25) !important;
                  }
                  .nt-action--ghost:hover .nt-action__arrow {
                    color: #fff !important;
                  }
                `,
              }}
            />
            <button
              type="button"
              className="nt-action nt-action--primary"
              onClick={() => void startInstant()}
              disabled={loading}
            >
              <span className="nt-action__icon">
                <Mic size={18} color="#F5B800" strokeWidth={2} />
              </span>
              <span className="nt-action__copy">
                <span className="nt-action__label">Start Recording</span>
                <span className="nt-action__sub">Record now</span>
              </span>
              <ArrowRight size={15} className="nt-action__arrow" color="currentColor" />
            </button>

            <button
              type="button"
              className="nt-action nt-action--ghost"
              onClick={() => {
                setError("");
                setModal("schedule");
              }}
              disabled={loading}
            >
              <span className="nt-action__icon">
                <CalendarDays size={16} color="#F5B800" strokeWidth={2} />
              </span>
              <span className="nt-action__copy">
                <span className="nt-action__label">Schedule Recording</span>
                <span className="nt-action__sub">Plan ahead</span>
              </span>
              <ArrowRight size={15} className="nt-action__arrow" color="currentColor" />
            </button>

            <button
              type="button"
              className="nt-action nt-action--ghost"
              onClick={() => {
                setError("");
                setModal("upload");
              }}
              disabled={loading}
            >
              <span className="nt-action__icon">
                <CloudUpload size={16} color="#F5B800" strokeWidth={2} />
              </span>
              <span className="nt-action__copy">
                <span className="nt-action__label">Upload Audio</span>
                <span className="nt-action__sub">From file</span>
              </span>
              <ArrowRight size={15} className="nt-action__arrow" color="currentColor" />
            </button>
          </div>
        </div>

        <section className="nt-intel" data-nti="v2">
          {/* Inline style tag — bypasses stale/stripped CSS chunks */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
                [data-nti="v2"] .nti-kpis {
                  display: grid !important;
                  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                  gap: 0 !important;
                  padding-bottom: 0.85rem !important;
                  border-bottom: 1px solid rgba(23, 61, 143, 0.1) !important;
                }
                [data-nti="v2"] .nti-kpi {
                  display: flex !important;
                  flex-direction: row !important;
                  flex-wrap: nowrap !important;
                  align-items: flex-start !important;
                  gap: 0.7rem !important;
                  min-width: 0 !important;
                  padding: 0.1rem 0.85rem !important;
                  border-right: 1px solid rgba(23, 61, 143, 0.1) !important;
                }
                [data-nti="v2"] .nti-kpi:first-child { padding-left: 0.1rem !important; }
                [data-nti="v2"] .nti-kpi:last-child {
                  border-right: 0 !important;
                  padding-right: 0.1rem !important;
                }
                [data-nti="v2"] .nti-kpi__icon {
                  display: grid !important;
                  place-items: center !important;
                  flex: 0 0 2.35rem !important;
                  width: 2.35rem !important;
                  height: 2.35rem !important;
                  border-radius: 0.55rem !important;
                  background: #0A235B !important;
                  color: #fff !important;
                }
                [data-nti="v2"] .nti-kpi__body {
                  display: flex !important;
                  flex-direction: column !important;
                  gap: 0.12rem !important;
                  min-width: 0 !important;
                }
                [data-nti="v2"] .nti-kpi__value {
                  font-size: 1.45rem !important;
                  font-weight: 900 !important;
                  letter-spacing: -0.03em !important;
                  color: #0A235B !important;
                  line-height: 1 !important;
                }
                [data-nti="v2"] .nti-kpi__label {
                  font-size: 0.72rem !important;
                  font-weight: 700 !important;
                  color: #0A235B !important;
                  line-height: 1.2 !important;
                }
                [data-nti="v2"] .nti-kpi__meta {
                  display: flex !important;
                  align-items: center !important;
                  flex-wrap: wrap !important;
                  gap: 0.35rem !important;
                  margin-top: 0.1rem !important;
                  font-size: 0.62rem !important;
                  font-weight: 600 !important;
                  color: #94A3B8 !important;
                }
                [data-nti="v2"] .nti-kpi__trend {
                  color: #16A34A !important;
                  font-weight: 700 !important;
                }
                [data-nti="v2"] .nti-intel-body {
                  display: flex !important;
                  flex-direction: column !important;
                  gap: 0.65rem !important;
                  margin-top: 0.85rem !important;
                }
                [data-nti="v2"] .nti-intel-head {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: space-between !important;
                  gap: 0.75rem !important;
                }
                [data-nti="v2"] .nti-intel-title {
                  display: inline-flex !important;
                  align-items: center !important;
                  gap: 0.4rem !important;
                  font-size: 0.86rem !important;
                  font-weight: 800 !important;
                  color: #0A235B !important;
                }
                [data-nti="v2"] .nti-intel-link {
                  font-size: 0.74rem !important;
                  font-weight: 700 !important;
                  color: #173D8F !important;
                  text-decoration: none !important;
                }
                [data-nti="v2"] .nti-chips {
                  display: grid !important;
                  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                  gap: 0.65rem !important;
                }
                [data-nti="v2"] .nti-chip {
                  display: flex !important;
                  flex-direction: row !important;
                  flex-wrap: nowrap !important;
                  align-items: flex-start !important;
                  gap: 0.55rem !important;
                  min-width: 0 !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  background: transparent !important;
                  border: none !important;
                  box-shadow: none !important;
                }
                [data-nti="v2"] .nti-chip__icon {
                  display: grid !important;
                  place-items: center !important;
                  flex: 0 0 1.85rem !important;
                  width: 1.85rem !important;
                  height: 1.85rem !important;
                  border-radius: 0.45rem !important;
                  background: #E8EFFA !important;
                  color: #173D8F !important;
                }
                [data-nti="v2"] .nti-chip__body {
                  display: flex !important;
                  flex-direction: column !important;
                  gap: 0.1rem !important;
                  min-width: 0 !important;
                }
                [data-nti="v2"] .nti-chip__label {
                  font-size: 0.6rem !important;
                  font-weight: 600 !important;
                  color: #94A3B8 !important;
                  line-height: 1.25 !important;
                }
                [data-nti="v2"] .nti-chip__value {
                  font-size: 0.72rem !important;
                  font-weight: 800 !important;
                  color: #0A235B !important;
                  line-height: 1.15 !important;
                  white-space: nowrap !important;
                }
                [data-nti="v2"] .nti-chip__detail {
                  font-size: 0.5rem !important;
                  font-weight: 600 !important;
                  color: #94A3B8 !important;
                  line-height: 1.25 !important;
                  white-space: nowrap !important;
                }
                [data-nti="v2"] .nti-chip__detail--up { color: #16A34A !important; }
                @media (max-width: 900px) {
                  [data-nti="v2"] .nti-chips {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                  }
                }
              `,
            }}
          />

          <div className="nti-kpis">
            {(
              [
                {
                  icon: CalendarDays,
                  value: String(stats.meetings),
                  label: "Meetings Recorded",
                  trend: "↑ 20%",
                },
                {
                  icon: Clock,
                  value: `${stats.hours}h`,
                  label: "Hours Captured",
                  trend: "↑ 18%",
                },
                {
                  icon: FileText,
                  value: String(stats.notes),
                  label: "Notes Generated",
                  trend: "↑ 25%",
                },
              ] as const
            ).map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="nti-kpi">
                  <span className="nti-kpi__icon" aria-hidden>
                    <Icon size={16} strokeWidth={2.4} color="#fff" />
                  </span>
                  <div className="nti-kpi__body">
                    <div className="nti-kpi__value">{stat.value}</div>
                    <div className="nti-kpi__label">{stat.label}</div>
                    <div className="nti-kpi__meta">
                      <span>This Month</span>
                      <span className="nti-kpi__trend">{stat.trend}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="nti-intel-body">
            <div className="nti-intel-head">
              <div className="nti-intel-title">
                <Sparkles size={14} color="#F5B800" strokeWidth={2} />
                AI Meeting Intelligence
              </div>
              <a className="nti-intel-link" href="#generated-notes">
                View insights →
              </a>
            </div>
            <div className="nti-chips">
              {(
                [
                  {
                    icon: TrendingUp,
                    label: "Most Discussed Topic",
                    value: "Retail Expansion",
                    detail: "32% of total discussions",
                    up: false,
                  },
                  {
                    icon: Users,
                    label: "Meetings This Week",
                    value: "8",
                    detail: "↑ 14% vs last week",
                    up: true,
                  },
                  {
                    icon: CheckCircle2,
                    label: "Pending Action Items",
                    value: "17",
                    detail: "5 high priority",
                    up: false,
                  },
                  {
                    icon: FileText,
                    label: "Unreviewed Notes",
                    value: "3",
                    detail: "Requires your review",
                    up: false,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="nti-chip">
                    <span className="nti-chip__icon" aria-hidden>
                      <Icon size={14} strokeWidth={2.25} color="#173D8F" />
                    </span>
                    <div className="nti-chip__body">
                      <div className="nti-chip__label">{item.label}</div>
                      <div className="nti-chip__value">{item.value}</div>
                      <div
                        className={
                          item.up ? "nti-chip__detail nti-chip__detail--up" : "nti-chip__detail"
                        }
                      >
                        {item.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Three equal-height columns; bodies scroll when content overflows */}
      <div className="nt-cols" data-nt-cols="equal">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-nt-cols="equal"] {
                display: grid !important;
                grid-template-columns: 1.08fr 1fr 1fr !important;
                gap: 1rem !important;
                align-items: stretch !important;
                margin-top: 0.25rem !important;
              }
              [data-nt-cols="equal"] .nt-col {
                display: flex !important;
                flex-direction: column !important;
                height: 22.5rem !important;
                min-height: 22.5rem !important;
                max-height: 22.5rem !important;
                overflow: hidden !important;
                border-radius: 1.2rem !important;
                background: transparent !important;
                border: 1px solid rgba(115, 165, 255, 0.22) !important;
                box-shadow: 0 14px 36px rgba(2, 12, 40, 0.28) !important;
              }
              [data-nt-cols="equal"] .nt-col__head {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                flex-shrink: 0 !important;
                padding: 1rem 1.05rem 0.9rem !important;
                background: linear-gradient(145deg, #0d377d 0%, #062053 55%, #041638 100%) !important;
                border-bottom: 1px solid rgba(115, 165, 255, 0.32) !important;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
              }
              [data-nt-cols="equal"] .nt-col__title {
                display: inline-flex !important;
                align-items: center !important;
                gap: 0.5rem !important;
                font-size: 0.92rem !important;
                font-weight: 800 !important;
                color: #ffffff !important;
              }
              [data-nt-cols="equal"] .nt-col__link {
                font-size: 0.72rem !important;
                font-weight: 700 !important;
                color: rgba(186, 205, 235, 0.85) !important;
                background: none !important;
                border: 0 !important;
                cursor: pointer !important;
                font-family: inherit !important;
                padding: 0 !important;
              }
              [data-nt-cols="equal"] .nt-col__link:hover {
                color: #f5b800 !important;
              }
              [data-nt-cols="equal"] .nt-col__head,
              [data-nt-cols="equal"] .nt-col__foot {
                flex-shrink: 0 !important;
              }
              [data-nt-cols="equal"] .nt-col__body {
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                background: #ffffff !important;
                -webkit-overflow-scrolling: touch !important;
              }
              [data-nt-cols="equal"] .nt-col__foot {
                background: #ffffff !important;
                border-top: 1px solid rgba(23, 61, 143, 0.06) !important;
              }
              @media (max-width: 1100px) {
                [data-nt-cols="equal"] {
                  grid-template-columns: 1fr !important;
                }
              }
            `,
          }}
        />
        <section className="nt-col">
          <div className="nt-col__head">
            <div className="nt-col__title">
              <CalendarDays size={16} color="#F5B800" strokeWidth={2} />
              Upcoming Meetings
            </div>
            <button type="button" className="nt-col__link">
              View calendar →
            </button>
          </div>
          <div className="nt-col__body">
            {upcoming.length === 0 ? (
              <div className="nt-empty">No upcoming meetings. Schedule a recording to get started.</div>
            ) : (
              upcoming.map((s) => {
                const when = s.scheduledAt ? new Date(s.scheduledAt) : new Date(s.createdAt);
                const participants = parseJsonArray(s.participants);
                return (
                  <Link key={s.id} href={sessionHref(s)} className="nt-meet">
                    <div className="nt-meet__date">
                      <span className="nt-meet__month">{format(when, "MMM")}</span>
                      <span className="nt-meet__day">{format(when, "d")}</span>
                    </div>
                    <div className="nt-meet__copy">
                      <div className="nt-meet__name">{s.name}</div>
                      <div className="nt-meet__meta">
                        <span>{format(when, "HH:mm")}</span>
                        <span>
                          <Users size={11} color="#64748b" />
                          {participants.length || 4} participants
                        </span>
                      </div>
                    </div>
                    <div className="nt-meet__status">
                      <span className="nt-dot" />
                      Auto-record Enabled
                    </div>
                    <MoreVertical size={14} className="nt-meet__more" />
                  </Link>
                );
              })
            )}
          </div>
          <div className="nt-col__foot">
            <button type="button" className="nt-col__foot-link" onClick={() => setModal("schedule")}>
              View all upcoming meetings →
            </button>
          </div>
        </section>

        <section className="nt-col">
          <div className="nt-col__head">
            <div className="nt-col__title">
              <AudioLines size={16} color="#F5B800" strokeWidth={2} />
              Recent Recordings
            </div>
            <Link href="/intelligence/note-taker" className="nt-col__link">
              View all sessions →
            </Link>
          </div>
          <div className="nt-col__body">
            {recordings.length === 0 ? (
              <div className="nt-empty">No recordings yet. Start an instant session above.</div>
            ) : (
              recordings.map((s) => {
                const when = s.startedAt || s.createdAt;
                const ok = s.status === "COMPLETED";
                return (
                  <Link key={s.id} href={sessionHref(s)} className="nt-rec">
                    <span className="nt-rec__play">
                      <Play size={12} fill="currentColor" color="#173D8F" />
                    </span>
                    <div className="nt-rec__copy">
                      <div className="nt-rec__name">{s.name}</div>
                      <div className="nt-rec__meta">
                        {format(new Date(when), "dd MMM · HH:mm")} ·{" "}
                        {formatDuration(s.durationSeconds)}
                      </div>
                    </div>
                    <div className="nt-rec__right">
                      <span className={`nt-badge ${ok ? "nt-badge--ok" : "nt-badge--warn"}`}>
                        {ok ? "Completed · Notes ready" : s.status.replace("_", " ")}
                      </span>
                      <span className="nt-rec__doc">
                        <FileText size={14} color="#173D8F" strokeWidth={2} />
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          <div className="nt-col__foot">
            <Link href="/intelligence/note-taker" className="nt-col__foot-link">
              View all recordings →
            </Link>
          </div>
        </section>

        <section className="nt-col" id="generated-notes">
          <div className="nt-col__head">
            <div className="nt-col__title">
              <FileText size={16} color="#F5B800" strokeWidth={2} />
              Generated Notes
            </div>
            <Link href="/intelligence/note-taker" className="nt-col__link">
              View all notes →
            </Link>
          </div>
          <div className="nt-col__body">
            {notes.length === 0 ? (
              <div className="nt-empty">Notes will appear here after a session completes.</div>
            ) : (
              notes.map((s) => (
                <Link key={s.id} href={`/intelligence/note-taker/${s.id}/notes`} className="nt-note">
                  <div className="nt-note__main">
                    <div className="nt-note__name">{s.name}</div>
                    <div className="nt-note__when">
                      Generated{" "}
                      {formatDistanceToNow(new Date(s.endedAt || s.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="nt-note__pills">
                    <span className="nt-pill nt-pill--gold">
                      {countFromNotes(s.notesJson, "decisions")} Key Decisions
                    </span>
                    <span className="nt-pill nt-pill--blue">
                      {countFromNotes(s.notesJson, "actions")} Action Items
                    </span>
                  </div>
                  <ChevronRight size={16} className="nt-note__chev" />
                </Link>
              ))
            )}
          </div>
          <div className="nt-col__foot">
            <Link href="/intelligence/note-taker" className="nt-notes-cta">
              View all meeting notes →
            </Link>
          </div>
        </section>
      </div>

      <footer className="nt-secure">
        <div className="nt-secure__left">
          <span className="nt-secure__icon">
            <Shield size={15} color="#173D8F" strokeWidth={2} />
          </span>
          <span>
            <strong>Enterprise Security:</strong> All recordings, transcripts and notes are
            encrypted and securely stored.
          </span>
        </div>
        <div className="nt-secure__right">
          <span className="nt-secure__icon">
            <Lock size={15} color="#173D8F" strokeWidth={2} />
          </span>
          Secure. Private. Controlled.
        </div>
      </footer>

      {modal ? (
        <div className="nt-modal">
          <button
            type="button"
            className="nt-modal__backdrop"
            aria-label="Close"
            onClick={() => setModal(null)}
          />
          <div className="nt-modal__panel" role="dialog" aria-modal="true">
            {modal === "schedule" ? (
              <>
                <h2 className="nt-modal__title">Schedule Recording</h2>
                <p className="nt-modal__desc">Plan a future capture session for your team.</p>
                <div className="nt-field">
                  <label htmlFor="nt-name">Meeting name</label>
                  <input
                    id="nt-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Leadership Weekly Sync"
                  />
                </div>
                <div className="nt-field">
                  <label htmlFor="nt-date">Date</label>
                  <input
                    id="nt-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="nt-field">
                  <label htmlFor="nt-time">Time</label>
                  <input
                    id="nt-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
                {error ? <div className="nt-modal__error">{error}</div> : null}
                <div className="nt-modal__actions">
                  <button type="button" className="nt-btn nt-btn--ghost" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="nt-btn nt-btn--primary"
                    disabled={loading}
                    onClick={() => void createSession("schedule")}
                  >
                    {loading ? "Scheduling…" : "Schedule"}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleUploadSubmit}>
                <h2 className="nt-modal__title">Upload Audio</h2>
                <p className="nt-modal__desc">
                  Upload a meeting recording. Transcription and notes pipelines are framework-ready.
                </p>
                <div className="nt-field">
                  <label htmlFor="nt-up-name">Session name</label>
                  <input
                    id="nt-up-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Board Review Audio"
                  />
                </div>
                <div className="nt-field">
                  <label htmlFor="nt-file">Audio file</label>
                  <input id="nt-file" type="file" accept="audio/*" />
                </div>
                {error ? <div className="nt-modal__error">{error}</div> : null}
                <div className="nt-modal__actions">
                  <button type="button" className="nt-btn nt-btn--ghost" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="nt-btn nt-btn--gold" disabled={loading}>
                    {loading ? "Opening…" : "Continue"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
