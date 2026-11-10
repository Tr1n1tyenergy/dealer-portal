"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  Paperclip,
  Send,
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

function eventLabel(e: DetailTicket["events"][number]) {
  if (e.type === "CREATED") return "Ticket submitted";
  if (e.type === "STATUS_CHANGED") {
    return `Status changed${e.fromValue ? ` from ${e.fromValue}` : ""}${e.toValue ? ` to ${e.toValue}` : ""}`;
  }
  if (e.type === "MESSAGE_ADDED") return "New message";
  if (e.type === "ATTACHMENT_ADDED") return `Attachment added${e.toValue ? `: ${e.toValue}` : ""}`;
  if (e.type === "CLOSED") return "Ticket closed";
  if (e.type === "RESOLVED") return "Ticket resolved";
  if (e.type === "ASSIGNED") return "Ticket assigned";
  if (e.type === "REOPENED") return "Ticket reopened";
  return e.type;
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
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/support/tickets/${ticketId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Ticket not found.");
      return;
    }
    setTicket(data.ticket);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
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

  if (!ticket && !error) {
    return (
      <div className="ds__main" style={{ marginTop: "-1.85rem", maxWidth: 1280, marginLeft: "auto", marginRight: "auto" }}>
        <p className="ds__empty">Loading ticket…</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ds__workspace" style={{ gridTemplateColumns: "1fr" }}>
        <div className="ds__main">
          <Link href="/dealer/support" className="ds__back">
            <ArrowLeft size={15} /> Back to support centre
          </Link>
          <p className="ds__error">{error || "Ticket not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ds__workspace" style={{ gridTemplateColumns: "1fr" }}>
      <div className="ds__main">
        <Link href="/dealer/support" className="ds__back">
          <ArrowLeft size={15} /> Back to my tickets
        </Link>

        <div className="ds__main-head">
          <div>
            <h2>
              {ticket.reference} · {ticket.subject}
            </h2>
            <p>
              Created {fmt(ticket.createdAt)} · Updated {fmt(ticket.updatedAt)}
            </p>
          </div>
        </div>

        <div className="ds__detail-meta">
          <span className={`ds__pill ds__pill--status-${ticket.status}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
          <span className={`ds__pill ds__pill--priority-${ticket.priority}`}>
            {PRIORITY_LABELS[ticket.priority]}
          </span>
          <span className="ds__dept">{DEPARTMENT_LABELS[ticket.department]}</span>
        </div>

        {error ? (
          <p className="ds__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ds__detail-grid">
          <div className="ds__panel">
            <h3>Ticket information</h3>
            <p>
              <strong>
                {ticket.createdBy.firstName} {ticket.createdBy.lastName}
              </strong>
              <br />
              {ticket.createdBy.email}
              <br />
              {ticket.dealerOrganization.name}
            </p>
            {ticket.relatedOrder ? (
              <p style={{ marginTop: "0.75rem" }}>
                Related order:{" "}
                <Link href={`/dealer/orders/${ticket.relatedOrder.id}`}>
                  {ticket.relatedOrder.reference}
                </Link>
              </p>
            ) : null}
          </div>
          <div className="ds__panel">
            <h3>Original description</h3>
            <p>{ticket.description}</p>
          </div>
        </div>

        {ticket.attachments.length ? (
          <div className="ds__panel" style={{ marginBottom: "1rem" }}>
            <h3>Attachments</h3>
            <div className="ds__files">
              {ticket.attachments.map((a) => (
                <div key={a.id} className="ds__file">
                  <Paperclip size={14} />
                  <span>
                    {a.fileName} · {(a.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                  <a
                    href={`/api/support/tickets/${ticket.id}/attachments/${a.id}`}
                    style={{ marginLeft: "auto", color: "#3853a4" }}
                    aria-label={`Download ${a.fileName}`}
                  >
                    <Download size={15} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {ticket.resolutionSummary ? (
          <div className="ds__panel" style={{ marginBottom: "1rem" }}>
            <h3>Resolution</h3>
            <p>{ticket.resolutionSummary}</p>
          </div>
        ) : null}

        <div className="ds__detail-grid">
          <div className="ds__panel">
            <h3>Status history</h3>
            <div className="ds__timeline">
              {ticket.events.map((e) => (
                <div key={e.id} className="ds__timeline-item">
                  <strong>{eventLabel(e)}</strong>
                  {e.note ? <span>{e.note}</span> : null}
                  <span>{fmt(e.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ds__panel">
            <h3>Conversation</h3>
            <div className="ds__thread">
              {ticket.messages.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "0.84rem" }}>
                  No replies yet. Trinity staff will respond here.
                </p>
              ) : (
                ticket.messages.map((m) => {
                  const mine = m.author.id === myUserId;
                  return (
                    <div
                      key={m.id}
                      className={`ds__bubble ${mine ? "ds__bubble--mine" : "ds__bubble--theirs"}`}
                    >
                      <div>{m.body}</div>
                      <footer>
                        {mine
                          ? "You"
                          : `${m.author.firstName} ${m.author.lastName}`}{" "}
                        · {fmt(m.createdAt)}
                      </footer>
                    </div>
                  );
                })
              )}
            </div>

            {ticket.status !== "CLOSED" ? (
              <form className="ds__composer" onSubmit={sendReply}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply…"
                  rows={2}
                />
                <button
                  type="submit"
                  className="ds__btn-yellow"
                  disabled={sending || !reply.trim()}
                  aria-label="Send reply"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.84rem" }}>
                This ticket is closed. Raise a new ticket if you need more help.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
