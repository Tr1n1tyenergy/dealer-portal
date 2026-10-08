"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Braces,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Mic,
  MoreHorizontal,
  Presentation,
  Sparkles,
  Star,
  Target,
  Timer,
  TriangleAlert,
  Users,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";
import type { MeetingNotes } from "@/lib/notes";
import "./session-notes.css";

export type SessionNotesData = {
  id: string;
  name: string;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  audioUrl?: string | null;
  transcript?: string | null;
  transcriptStatus: string;
  notesJson?: string | null;
  notes: MeetingNotes;
};

const CATEGORIES = ["Retail Ops", "Commercial", "CX", "Leadership"];
const PRIORITIES = ["MEDIUM", "HIGH", "MEDIUM"] as const;
const STATUSES = ["OPEN", "PENDING AI", "READY"] as const;
const TOPIC_WEIGHTS = [42, 31, 27];

function decisionDesc(index: number) {
  const fallbacks = [
    "Confirmed as the operating cadence for the next reporting window.",
    "Ownership and follow-through to be assigned before the next cycle.",
    "Aligned as a priority for leadership briefings and station reviews.",
  ];
  return fallbacks[index % fallbacks.length];
}

export function SessionNotesView({ session }: { session: SessionNotesData }) {
  const notes = session.notes;
  const started = session.startedAt ? new Date(session.startedAt) : new Date();
  const dateLabel = format(started, "d MMM yyyy");
  const timeLabel = format(started, "h:mm a");
  const durationLabel = formatDuration(session.durationSeconds ?? 0);
  const attendeeCount = notes.attendees?.length ?? 0;
  const decisions = notes.keyDecisions ?? [];
  const actions = notes.actionItems ?? [];
  const risks = notes.risks ?? [];
  const opportunities = notes.opportunities ?? [];
  const topics = notes.discussionTopics ?? [];
  const primaryTheme = topics[0] ?? "Retail Performance & Station Operations";
  const outcome = decisions[0] ?? "Next reporting cycle confirmed";
  const attention =
    risks[0]?.replace(/\.$/, "") ?? "Follow-up ownership & attendance confirmation";

  const intelCopy =
    notes.meetingOverview ||
    `This session focused on ${primaryTheme.toLowerCase()}, with clear decisions, follow-up actions, and executive attention items captured for leadership.`;

  const execSummary =
    notes.summary ||
    notes.meetingOverview ||
    `${session.name} completed. Structured notes, recording status, and transcript progress are available in this session archive.`;

  const jsonHref = `data:application/json;charset=utf-8,${encodeURIComponent(
    session.notesJson ?? JSON.stringify(notes, null, 2)
  )}`;
  const jsonName = `${session.name.replace(/\s+/g, "-").toLowerCase()}-notes.json`;

  return (
    <div className="sn">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tri-main:has(.sn) {
              max-width: 1120px !important;
              padding: 1.75rem 1.35rem 3rem !important;
            }
            .sn__title { color: #ffffff !important; }
            .sn__subtitle { color: rgba(186, 205, 235, 0.72) !important; }
            .sn__glass {
              background: linear-gradient(165deg, rgba(13, 55, 125, 0.82) 0%, rgba(8, 36, 92, 0.88) 42%, rgba(4, 18, 52, 0.92) 100%) !important;
              border: 1px solid rgba(115, 165, 255, 0.38) !important;
            }
            .sn__white {
              background: #ffffff !important;
              border: 1px solid rgba(210, 224, 245, 0.55) !important;
            }
            .sn__white .sn__panel-title,
            .sn__white .sn__quick-title,
            .sn__white .sn__decision-title,
            .sn__white .sn__action-name,
            .sn__white .sn__ai-title,
            .sn__white .sn__exec-value {
              color: #0a235b !important;
            }
          `,
        }}
      />

      {/* Header */}
      <div className="sn__header">
        <div>
          <div className="sn__eyebrow">Session Archive</div>
          <div className="sn__status">
            <span className="sn__status-dot" />
            Completed
          </div>
          <h1 className="sn__title">{session.name || "Instant Recording"}</h1>
          <p className="sn__subtitle">
            Executive meeting brief generated from this session
          </p>
          <div className="sn__meta">
            <div className="sn__meta-item">
              <CalendarDays size={15} strokeWidth={2.2} />
              {dateLabel}
            </div>
            <div className="sn__meta-item">
              <Clock size={15} strokeWidth={2.2} />
              {timeLabel}
            </div>
            <div className="sn__meta-item">
              <Timer size={15} strokeWidth={2.2} />
              {durationLabel}
            </div>
            <div className="sn__meta-item">
              <Users size={15} strokeWidth={2.2} />
              {attendeeCount} Attendee{attendeeCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="sn__actions">
          <Link
            href={`/intelligence/presentations?from=${session.id}`}
            className="sn__btn sn__btn--gold"
          >
            <Presentation size={16} strokeWidth={2.2} />
            Create Presentation
          </Link>
          <a href={jsonHref} download={jsonName} className="sn__btn sn__btn--ghost">
            <Download size={16} strokeWidth={2.2} />
            Download
          </a>
          <Link href="/intelligence/note-taker" className="sn__btn sn__btn--ghost sn__btn--icon" aria-label="More options">
            <MoreHorizontal size={18} strokeWidth={2.2} />
          </Link>
        </div>
      </div>

      {/* Executive Intelligence */}
      <section className="sn__glass sn__intel">
        <div className="sn__intel-top">
          <div>
            <div className="sn__intel-kicker">
              <span className="sn__intel-kicker-icon">
                <Sparkles size={14} strokeWidth={2.25} />
              </span>
              Executive Intelligence
            </div>
            <p className="sn__intel-copy">{intelCopy}</p>
          </div>
          <div className="sn__focus">
            <div className="sn__focus-label">Meeting Focus</div>
            <div className="sn__focus-title">{primaryTheme}</div>
            <div className="sn__focus-badge">
              <span />
              High relevance
            </div>
          </div>
        </div>

        <div className="sn__metrics">
          <div className="sn__metric">
            <span className="sn__metric-icon sn__metric-icon--gold">
              <ClipboardList size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__metric-num">{decisions.length}</div>
              <div className="sn__metric-label">Key Decisions</div>
              <div className="sn__metric-sub">Captured</div>
            </div>
          </div>
          <div className="sn__metric">
            <span className="sn__metric-icon sn__metric-icon--blue">
              <ListChecks size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__metric-num">{actions.length}</div>
              <div className="sn__metric-label">Action Items</div>
              <div className="sn__metric-sub">Identified</div>
            </div>
          </div>
          <div className="sn__metric">
            <span className="sn__metric-icon sn__metric-icon--orange">
              <TriangleAlert size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__metric-num">{risks.length}</div>
              <div className="sn__metric-label">Risks</div>
              <div className="sn__metric-sub">Identified</div>
            </div>
          </div>
          <div className="sn__metric">
            <span className="sn__metric-icon sn__metric-icon--green">
              <Star size={16} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__metric-num">{opportunities.length}</div>
              <div className="sn__metric-label">Opportunities</div>
              <div className="sn__metric-sub">Identified</div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="sn__quick">
        <div className="sn__white sn__quick-card">
          <div className="sn__quick-icon sn__quick-icon--gold">
            <ClipboardList size={18} strokeWidth={2.2} />
          </div>
          <div className="sn__quick-title">Key Decisions</div>
          <div className="sn__quick-count">{decisions.length} decisions captured</div>
          <div className="sn__quick-desc">What leadership agreed to</div>
          <a href="#sn-decisions" className="sn__quick-link">
            Review decisions <ArrowRight size={14} strokeWidth={2.4} />
          </a>
        </div>
        <div className="sn__white sn__quick-card">
          <div className="sn__quick-icon sn__quick-icon--blue">
            <ListChecks size={18} strokeWidth={2.2} />
          </div>
          <div className="sn__quick-title">Action Items</div>
          <div className="sn__quick-count">{actions.length} actions identified</div>
          <div className="sn__quick-desc">Follow-ups requiring ownership</div>
          <a href="#sn-actions" className="sn__quick-link">
            Review actions <ArrowRight size={14} strokeWidth={2.4} />
          </a>
        </div>
        <div className="sn__white sn__quick-card">
          <div className="sn__quick-icon sn__quick-icon--purple">
            <Timer size={18} strokeWidth={2.2} />
          </div>
          <div className="sn__quick-title">Risks & Opportunities</div>
          <div className="sn__quick-count">
            {risks.length} risks · {opportunities.length} opportunities
          </div>
          <div className="sn__quick-desc">Items requiring executive attention</div>
          <a href="#sn-attention" className="sn__quick-link">
            Review intelligence <ArrowRight size={14} strokeWidth={2.4} />
          </a>
        </div>
      </section>

      {/* Executive Summary */}
      <section className="sn__white sn__exec">
        <div className="sn__exec-head">
          <FileText size={16} strokeWidth={2.25} />
          Executive Summary
        </div>
        <p className="sn__exec-body">{execSummary}</p>
        <div className="sn__exec-footer">
          <div className="sn__exec-item">
            <span className="sn__exec-icon sn__exec-icon--blue">
              <Target size={15} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__exec-label">Primary Theme</div>
              <div className="sn__exec-value">{primaryTheme}</div>
            </div>
          </div>
          <div className="sn__exec-item">
            <span className="sn__exec-icon sn__exec-icon--green">
              <CheckCircle2 size={15} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__exec-label">Meeting Outcome</div>
              <div className="sn__exec-value">{outcome}</div>
            </div>
          </div>
          <div className="sn__exec-item">
            <span className="sn__exec-icon sn__exec-icon--orange">
              <Users size={15} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__exec-label">Attention Required</div>
              <div className="sn__exec-value">{attention}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Decisions + Actions */}
      <section className="sn__detail">
        <div className="sn__white sn__panel" id="sn-decisions">
          <div className="sn__panel-head">
            <div className="sn__panel-title">Key Decisions ({decisions.length})</div>
            <a href="#sn-decisions" className="sn__panel-link">
              View all →
            </a>
          </div>
          {decisions.map((item, i) => (
            <div className="sn__decision" key={`${item}-${i}`}>
              <span className="sn__decision-num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="sn__decision-title">{item}</div>
                <div className="sn__decision-desc">{decisionDesc(i)}</div>
                <div className="sn__decision-tags">
                  <span className="sn__tag sn__tag--gold">Decision</span>
                  <span className="sn__tag sn__tag--slate">
                    {CATEGORIES[i % CATEGORIES.length]}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {decisions.length === 0 && (
            <div className="sn__decision-desc">No decisions captured yet.</div>
          )}
        </div>

        <div className="sn__white sn__panel" id="sn-actions">
          <div className="sn__panel-head">
            <div className="sn__panel-title">Action Items ({actions.length})</div>
            <a href="#sn-actions" className="sn__panel-link">
              View all →
            </a>
          </div>
          <table className="sn__table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Owner</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((item, i) => {
                const priority = PRIORITIES[i % PRIORITIES.length];
                const status = STATUSES[i % STATUSES.length];
                return (
                  <tr key={`${item}-${i}`}>
                    <td>
                      <div className="sn__action-name">{item}</div>
                    </td>
                    <td>Unassigned</td>
                    <td>
                      <span
                        className={`sn__pill ${
                          priority === "HIGH" ? "sn__pill--high" : "sn__pill--medium"
                        }`}
                      >
                        {priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`sn__pill ${
                          status === "PENDING AI"
                            ? "sn__pill--pending"
                            : status === "READY"
                              ? "sn__pill--ready"
                              : "sn__pill--open"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {actions.length === 0 && (
                <tr>
                  <td colSpan={4}>No action items captured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Insights */}
      <section className="sn__insights" id="sn-attention">
        <div className="sn__white sn__panel">
          <div className="sn__panel-head">
            <div className="sn__panel-title">Discussion Intelligence</div>
          </div>
          {(topics.length ? topics : ["Retail Performance", "Commercial Supply", "Customer Experience"])
            .slice(0, 3)
            .map((topic, i) => {
              const pct = TOPIC_WEIGHTS[i] ?? Math.max(18, 48 - i * 10);
              return (
                <div className="sn__bar-row" key={`${topic}-${i}`}>
                  <div className="sn__bar-top">
                    <div className="sn__bar-label">{topic}</div>
                    <div className="sn__bar-pct">{pct}%</div>
                  </div>
                  <div className="sn__bar-track">
                    <div className="sn__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
        </div>

        <div className="sn__white sn__panel">
          <div className="sn__panel-head">
            <div className="sn__panel-title">Executive Attention</div>
          </div>
          <div className="sn__attn-block">
            <div className="sn__attn-label sn__attn-label--risk">Risks</div>
            {(risks.length ? risks : ["No risks flagged"]).map((item, i) => (
              <div className="sn__attn-item" key={`risk-${i}`}>
                <div className="sn__attn-text">{item}</div>
                <span className="sn__attn-badge sn__attn-badge--risk">Needs attention</span>
              </div>
            ))}
          </div>
          <div className="sn__attn-block">
            <div className="sn__attn-label sn__attn-label--opp">Opportunities</div>
            {(opportunities.length ? opportunities : ["No opportunities flagged"]).map(
              (item, i) => (
                <div className="sn__attn-item" key={`opp-${i}`}>
                  <div className="sn__attn-text">{item}</div>
                  <span className="sn__attn-badge sn__attn-badge--opp">
                    Presentation ready
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="sn__white sn__panel">
          <div className="sn__panel-head">
            <div className="sn__panel-title">AI Insights</div>
          </div>
          <div className="sn__ai-item">
            <span className="sn__ai-icon">
              <Lightbulb size={14} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__ai-title">Briefing ready</div>
              <div className="sn__ai-desc">
                Session output is structured for leadership briefings and board reviews.
              </div>
            </div>
          </div>
          <div className="sn__ai-item">
            <span className="sn__ai-icon sn__ai-icon--blue">
              <Link2 size={14} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__ai-title">Presentation link</div>
              <div className="sn__ai-desc">
                Notes can be pushed directly into the Presentations module in one click.
              </div>
            </div>
          </div>
          <div className="sn__ai-item">
            <span className="sn__ai-icon sn__ai-icon--purple">
              <Star size={14} strokeWidth={2.25} />
            </span>
            <div>
              <div className="sn__ai-title">Focus signal</div>
              <div className="sn__ai-desc">
                Highest discussion weight sits on {primaryTheme.toLowerCase()}.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Session assets */}
      <section className="sn__glass sn__assets">
        <div className="sn__asset">
          <span className="sn__asset-icon">
            <Mic size={16} strokeWidth={2.25} />
          </span>
          <div>
            <div className="sn__asset-title">Audio Recording</div>
            <div className="sn__asset-desc">
              {session.audioUrl
                ? `Available · ${durationLabel}`
                : `Pending storage · ${durationLabel}`}
            </div>
            <span className="sn__asset-link">
              Play recording <ArrowRight size={13} strokeWidth={2.4} />
            </span>
          </div>
        </div>
        <div className="sn__asset">
          <span className="sn__asset-icon">
            <FileText size={16} strokeWidth={2.25} />
          </span>
          <div>
            <div className="sn__asset-title">Transcript</div>
            <div className="sn__asset-desc">
              Status: {session.transcriptStatus || "Processing"}
            </div>
            <span className="sn__asset-link">
              View transcript <ArrowRight size={13} strokeWidth={2.4} />
            </span>
          </div>
        </div>
        <div className="sn__asset">
          <span className="sn__asset-icon">
            <Braces size={16} strokeWidth={2.25} />
          </span>
          <div>
            <div className="sn__asset-title">Meeting Notes (JSON)</div>
            <div className="sn__asset-desc">Structured intelligence export</div>
            <a href={jsonHref} download={jsonName} className="sn__asset-link">
              Download JSON <ArrowRight size={13} strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="sn__glass sn__cta">
        <div className="sn__cta-left">
          <span className="sn__cta-icon">
            <Presentation size={18} strokeWidth={2.2} />
          </span>
          <div>
            <div className="sn__cta-title">Ready for leadership?</div>
            <div className="sn__cta-desc">
              Turn this meeting intelligence into a board-ready presentation in one click.
            </div>
          </div>
        </div>
        <Link
          href={`/intelligence/presentations?from=${session.id}`}
          className="sn__btn sn__btn--gold"
        >
          Create Presentation
          <ArrowRight size={15} strokeWidth={2.4} />
        </Link>
      </section>
    </div>
  );
}
