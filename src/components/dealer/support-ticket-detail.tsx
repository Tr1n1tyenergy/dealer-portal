"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Flag,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Monitor,
  Paperclip,
  Route,
  Send,
  Ticket,
} from "lucide-react";
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type SupportDepartment,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support/constants";
import "@/app/dealer/dealer-support.css";
import "@/app/dealer/dealer-portal-hero.css";

type DetailTicket = {
  id: string;
  reference: string;
  subject: string;
  description: string;
  department: SupportDepartment;
  priority: SupportPriority;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  resolutionSummary?: string | null;
  createdBy: { firstName: string; lastName: string; email: string };
  dealerOrganization: { name: string };
  relatedOrder?: { id: string; reference: string } | null;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }[];
  messages: {
    id: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      accountType: string;
    };
  }[];
  events: {
    id: string;
    type: string;
    fromValue?: string | null;
    toValue?: string | null;
    note?: string | null;
    createdAt: string;
  }[];
};

const TIME_LOCALE = "en-GB";

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(TIME_LOCALE, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}, ${d.toLocaleTimeString(TIME_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  } catch {
    return "";
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileExt(name: string, mime: string) {
  const fromName = name.includes(".") ? name.split(".").pop() : "";
  if (fromName) return fromName.toUpperCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPG";
  if (mime.includes("webp")) return "WEBP";
  return "FILE";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return (parts[0] ?? "ME").slice(0, 2).toUpperCase();
}

function deptHeroLabel(dept: SupportDepartment) {
  return `${DEPARTMENT_LABELS[dept]} Support`;
}

function buildProgress(ticket: DetailTicket) {
  const submitted = {
    key: "submitted" as const,
    title: "Ticket submitted",
    text: "Your request was received.",
    state: "done" as "done" | "current" | "pending",
    at: ticket.createdAt,
  };

  const resolved =
    ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  const inFlight =
    ticket.status === "IN_PROGRESS" || ticket.status === "AWAITING_RESPONSE";

  const reviewAt =
    ticket.reviewedAt ||
    ticket.events.find((e) => e.type === "STATUS_CHANGED" || e.type === "ASSIGNED")?.createdAt ||
    (inFlight || resolved ? ticket.updatedAt : null);

  const underReview = {
    key: "review" as const,
    title: "Under review",
    text:
      ticket.status === "AWAITING_RESPONSE"
        ? "We need a little more information from you."
        : ticket.status === "IN_PROGRESS"
          ? `Our ${DEPARTMENT_LABELS[ticket.department]} team is working on your request.`
          : resolved
            ? `Our ${DEPARTMENT_LABELS[ticket.department]} team reviewed your request.`
            : `Our ${DEPARTMENT_LABELS[ticket.department]} team is reviewing your request.`,
    state: (resolved ? "done" : "current") as "done" | "current" | "pending",
    at: reviewAt,
  };

  const resolutionAt = ticket.resolvedAt || ticket.closedAt || null;
  const resolution = {
    key: "resolution" as const,
    title: "Resolution",
    text: resolved
      ? ticket.resolutionSummary || "This ticket has been resolved."
      : "We'll update this ticket once it's resolved.",
    state: (resolved ? "done" : "pending") as "done" | "current" | "pending",
    at: resolutionAt,
  };

  return [submitted, underReview, resolution];
}

export function SupportTicketDetail({
  ticketId,
  myUserId,
}: {
  ticketId: string;
  myUserId: string;
}) {
  const [ticket, setTicket] = useState<DetailTicket | null>(null);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachHint, setAttachHint] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Ticket not found.");
        setTicket(null);
        setLoadFailed(true);
        return;
      }
      setError("");
      setTicket(data.ticket);
    } catch {
      setError("Could not load this ticket.");
      setTicket(null);
      setLoadFailed(true);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ticket || !threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [ticket?.messages.length, ticket?.id]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending || !ticket || ticket.status === "CLOSED") return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send reply.");
        setSending(false);
        return;
      }
      setReply("");
      await load();
    } catch {
      setError("Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  const progress = useMemo(() => (ticket ? buildProgress(ticket) : []), [ticket]);

  const dealerName = ticket
    ? `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}`.trim() ||
      ticket.dealerOrganization.name
    : "";

  if (!ticket && !loadFailed && !error) {
    return (
      <div className="ds ds-ticket">
        <section className="ds__hero ds-ticket__hero" aria-hidden>
          <div className="ds__hero-inner">
            <div className="ds__hero-copy">
              <div className="ds-ticket__skel ds-ticket__skel--hero" />
            </div>
          </div>
        </section>
        <div className="ds-ticket__workspace ds-ticket__workspace--loading" aria-busy="true">
          <div className="ds-ticket__skel ds-ticket__skel--card" />
          <div className="ds-ticket__skel ds-ticket__skel--side" />
        </div>
        <p className="sr-only">Loading ticket…</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ds ds-ticket">
        <section className="ds__hero ds-ticket__hero">
          <div className="ds__hero-inner">
            <div className="ds__hero-copy">
              <Link href="/dealer/support" className="ds-ticket__back">
                <ArrowLeft size={15} strokeWidth={2.4} />
                Back to My Tickets
              </Link>
              <p className="ds__hero-kicker">SUPPORT CENTRE / TICKET DETAILS</p>
              <h1>Ticket unavailable</h1>
              <p>We couldn&apos;t load this support ticket.</p>
            </div>
          </div>
        </section>
        <div className="ds-ticket__workspace ds-ticket__workspace--solo">
          <div className="ds-ticket__card ds-ticket__empty">
            <strong>{error || "Ticket not found."}</strong>
            <p>It may have been removed, or you may not have access.</p>
            <div className="ds-ticket__empty-actions">
              <button type="button" className="ds__btn-outline" onClick={() => void load()}>
                Retry
              </button>
              <Link href="/dealer/support" className="ds__btn-yellow">
                Back to My Tickets
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canReply = ticket.status !== "CLOSED";

  return (
    <div className="ds ds-ticket">
      <section className="ds__hero ds-ticket__hero">
        <div className="ds__hero-inner">
          <div className="ds__hero-copy">
            <Link href="/dealer/support" className="ds-ticket__back">
              <ArrowLeft size={15} strokeWidth={2.4} />
              Back to My Tickets
            </Link>
            <p className="ds__hero-kicker">SUPPORT CENTRE / TICKET DETAILS</p>
            <h1>
              {ticket.reference} · {ticket.subject}
            </h1>
            <p className="ds-ticket__hero-meta">
              Submitted {fmt(ticket.createdAt)} · {DEPARTMENT_LABELS[ticket.department]} Department
            </p>
            <div className="ds-ticket__hero-pills">
              <span className={`ds__pill ds__pill--status-${ticket.status}`}>
                <i className="ds__status-dot" aria-hidden />
                {STATUS_LABELS[ticket.status]}
              </span>
              <span className={`ds__pill ds__pill--priority-${ticket.priority}`}>
                <Flag size={12} strokeWidth={2.2} aria-hidden />
                {PRIORITY_LABELS[ticket.priority]} Priority
              </span>
              <span className="ds-ticket__dept-pill">
                <Monitor size={12} strokeWidth={2.2} aria-hidden />
                {deptHeroLabel(ticket.department)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="ds-ticket__workspace">
        <div className="ds-ticket__col-main">
          <section className="ds-ticket__card ds-ticket__conversation">
            <header className="ds-ticket__card-head">
              <span className="ds-ticket__card-ico" aria-hidden>
                <MessageCircle size={16} strokeWidth={2.2} />
              </span>
              <div className="ds-ticket__card-copy">
                <h2>Conversation</h2>
                <p>Keep track of updates and communicate with the Trinity support team.</p>
              </div>
              <span className={`ds__pill ds__pill--status-${ticket.status}`}>
                <i className="ds__status-dot" aria-hidden />
                {STATUS_LABELS[ticket.status]}
              </span>
            </header>

            {error ? (
              <p className="ds__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ds-ticket__thread" ref={threadRef}>
              <article className="ds-ticket__msg ds-ticket__msg--dealer">
                <span className="ds-ticket__avatar ds-ticket__avatar--dealer" aria-hidden>
                  {initials(ticket.dealerOrganization.name || dealerName)}
                </span>
                <div className="ds-ticket__msg-body">
                  <header>
                    <strong>
                      {ticket.dealerOrganization.name}
                      <span> (You)</span>
                    </strong>
                    <time dateTime={ticket.createdAt}>{fmt(ticket.createdAt)}</time>
                  </header>
                  <div className="ds-ticket__bubble ds-ticket__bubble--dealer">
                    {ticket.description}
                  </div>
                  {ticket.attachments.length ? (
                    <ul className="ds-ticket__msg-files">
                      {ticket.attachments.map((a) => (
                        <li key={a.id}>
                          <Paperclip size={13} aria-hidden />
                          <span title={a.fileName}>
                            {a.fileName} ({formatBytes(a.sizeBytes)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>

              {ticket.messages.map((m) => {
                const isDealer = m.author.accountType === "DEALER" || m.author.id === myUserId;
                const isYou = m.author.id === myUserId;
                const name = isDealer
                  ? isYou
                    ? `${ticket.dealerOrganization.name} (You)`
                    : `${m.author.firstName} ${m.author.lastName}`.trim() || ticket.dealerOrganization.name
                  : `${m.author.firstName} ${m.author.lastName}`.trim() || "Trinity Support";
                return (
                  <article
                    key={m.id}
                    className={`ds-ticket__msg ${isDealer ? "ds-ticket__msg--dealer" : "ds-ticket__msg--staff"}`}
                  >
                    <span
                      className={`ds-ticket__avatar ${isDealer ? "ds-ticket__avatar--dealer" : "ds-ticket__avatar--staff"}`}
                      aria-hidden
                    >
                      {isDealer ? initials(ticket.dealerOrganization.name) : "TS"}
                    </span>
                    <div className="ds-ticket__msg-body">
                      <header>
                        <strong>{name}</strong>
                        <time dateTime={m.createdAt}>{fmt(m.createdAt)}</time>
                      </header>
                      <div
                        className={`ds-ticket__bubble ${isDealer ? "ds-ticket__bubble--dealer" : "ds-ticket__bubble--staff"}`}
                      >
                        {m.body}
                      </div>
                    </div>
                  </article>
                );
              })}

              {ticket.messages.length === 0 ? (
                <p className="ds-ticket__waiting">
                  No staff replies yet. Trinity Support will respond here.
                </p>
              ) : null}
            </div>

            {canReply ? (
              <form className="ds-ticket__composer" onSubmit={sendReply}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply to the support team..."
                  rows={3}
                  disabled={sending}
                />
                <div className="ds-ticket__composer-bar">
                  <div className="ds-ticket__composer-tools">
                    <button
                      type="button"
                      className="ds-ticket__tool"
                      aria-label="Attachments are available when raising a ticket"
                      title="Attachments can be added when raising a ticket"
                      onClick={() => setAttachHint(true)}
                    >
                      <Paperclip size={16} strokeWidth={2.1} />
                    </button>
                    <button
                      type="button"
                      className="ds-ticket__tool"
                      aria-label="Images can be attached when raising a ticket"
                      title="Images can be attached when raising a ticket"
                      onClick={() => setAttachHint(true)}
                    >
                      <ImageIcon size={16} strokeWidth={2.1} />
                    </button>
                    {attachHint ? (
                      <span className="ds-ticket__attach-hint">
                        Reply attachments aren&apos;t available yet — include files when raising a ticket.
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    className="ds__btn-yellow ds-ticket__send"
                    disabled={sending || !reply.trim()}
                  >
                    <Send size={15} strokeWidth={2.2} />
                    {sending ? "Sending…" : "Send Reply"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="ds-ticket__closed-note">
                This ticket is closed. Raise a new ticket if you need more help.
              </p>
            )}
          </section>

          <div className="ds-ticket__lower">
            <section className="ds-ticket__card">
              <header className="ds-ticket__card-head">
                <span className="ds-ticket__card-ico" aria-hidden>
                  <FileText size={16} strokeWidth={2.2} />
                </span>
                <div className="ds-ticket__card-copy">
                  <h2>Original Request</h2>
                </div>
              </header>
              <div className="ds-ticket__request">
                <div>
                  <span>Subject</span>
                  <strong>{ticket.subject}</strong>
                </div>
                <div>
                  <span>Description</span>
                  <p>{ticket.description}</p>
                </div>
              </div>
            </section>

            <section className="ds-ticket__card">
              <header className="ds-ticket__card-head">
                <span className="ds-ticket__card-ico" aria-hidden>
                  <Paperclip size={16} strokeWidth={2.2} />
                </span>
                <div className="ds-ticket__card-copy">
                  <h2>Attachments ({ticket.attachments.length})</h2>
                </div>
              </header>
              {ticket.attachments.length === 0 ? (
                <p className="ds-ticket__muted">No attachments on this ticket.</p>
              ) : (
                <ul className="ds-ticket__files">
                  {ticket.attachments.map((a) => {
                    const href = `/api/support/tickets/${ticket.id}/attachments/${a.id}`;
                    const previewable = a.mimeType.startsWith("image/") || a.mimeType === "application/pdf";
                    return (
                      <li key={a.id} className="ds-ticket__file">
                        <span className="ds-ticket__file-ico" aria-hidden>
                          {a.mimeType.startsWith("image/") ? (
                            <ImageIcon size={16} />
                          ) : (
                            <FileText size={16} />
                          )}
                        </span>
                        <div className="ds-ticket__file-meta">
                          <strong title={a.fileName}>{a.fileName}</strong>
                          <span>
                            {fileExt(a.fileName, a.mimeType)} · {formatBytes(a.sizeBytes)}
                          </span>
                        </div>
                        <div className="ds-ticket__file-actions">
                          {previewable ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="ds-ticket__icon-btn"
                              aria-label={`View ${a.fileName}`}
                            >
                              <Eye size={15} />
                            </a>
                          ) : null}
                          <a
                            href={href}
                            download={a.fileName}
                            className="ds-ticket__icon-btn"
                            aria-label={`Download ${a.fileName}`}
                          >
                            <Download size={15} />
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        <aside className="ds-ticket__col-side">
          <section className="ds-ticket__card">
            <header className="ds-ticket__card-head">
              <span className="ds-ticket__card-ico" aria-hidden>
                <ClipboardList size={16} strokeWidth={2.2} />
              </span>
              <div className="ds-ticket__card-copy">
                <h2>Ticket Overview</h2>
              </div>
            </header>
            <dl className="ds-ticket__overview">
              <div>
                <dt>
                  <Ticket size={14} aria-hidden />
                  Ticket Reference
                </dt>
                <dd className="ds-ticket__ref">{ticket.reference}</dd>
              </div>
              <div>
                <dt>
                  <Layers size={14} aria-hidden />
                  Department
                </dt>
                <dd>{DEPARTMENT_LABELS[ticket.department]}</dd>
              </div>
              <div>
                <dt>
                  <Flag size={14} aria-hidden />
                  Priority
                </dt>
                <dd>
                  <span className={`ds__pill ds__pill--priority-${ticket.priority}`}>
                    {PRIORITY_LABELS[ticket.priority]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>
                  <Circle size={14} aria-hidden />
                  Status
                </dt>
                <dd>
                  <span className={`ds__pill ds__pill--status-${ticket.status}`}>
                    <i className="ds__status-dot" aria-hidden />
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>
                  <FileText size={14} aria-hidden />
                  Related Order
                </dt>
                <dd>
                  {ticket.relatedOrder ? (
                    <Link href={`/dealer/orders/${ticket.relatedOrder.id}`} className="ds-ticket__link">
                      {ticket.relatedOrder.reference}
                    </Link>
                  ) : (
                    <span className="ds-ticket__muted">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <ClipboardList size={14} aria-hidden />
                  Created
                </dt>
                <dd className="ds-ticket__nowrap">{fmt(ticket.createdAt)}</dd>
              </div>
              <div>
                <dt>
                  <Route size={14} aria-hidden />
                  Last Updated
                </dt>
                <dd className="ds-ticket__nowrap">{fmt(ticket.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="ds-ticket__card">
            <header className="ds-ticket__card-head">
              <span className="ds-ticket__card-ico" aria-hidden>
                <Route size={16} strokeWidth={2.2} />
              </span>
              <div className="ds-ticket__card-copy">
                <h2>Ticket Progress</h2>
              </div>
            </header>
            <ol className="ds-ticket__progress">
              {progress.map((step) => (
                <li key={step.key} className={`is-${step.state}`}>
                  <span className="ds-ticket__progress-marker" aria-hidden>
                    {step.state === "done" ? (
                      <CheckCircle2 size={16} strokeWidth={2.2} />
                    ) : step.state === "current" ? (
                      <span className="ds-ticket__progress-dot" />
                    ) : (
                      <span className="ds-ticket__progress-hollow" />
                    )}
                  </span>
                  <div className="ds-ticket__progress-copy">
                    <div className="ds-ticket__progress-top">
                      <strong>{step.title}</strong>
                      {step.at ? <time dateTime={step.at}>{fmt(step.at)}</time> : null}
                    </div>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
