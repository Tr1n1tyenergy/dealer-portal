"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageCircle,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import { supportStaffAction } from "@/lib/support/staff-actions";

/**
 * Reply composer with real textarea formatting inserts (markdown-ish plain text).
 * Backend stores plain text — toolbar inserts markers into the message body.
 */
export function StaffSupportCompose({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function wrap(before: string, after = before) {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    el.value = next;
    const cursor = start + before.length + selected.length + after.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  function insertLine(prefix: string) {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const value = el.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    el.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    el.focus();
    const cursor = start + prefix.length;
    el.setSelectionRange(cursor, cursor);
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    wrap("[", `](${url.trim()})`);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) {
      setError("Enter a message before sending.");
      return;
    }
    startTransition(async () => {
      try {
        await supportStaffAction(new FormData(form));
        form.reset();
        router.refresh();
      } catch {
        setError("Could not send reply. Try again.");
      }
    });
  }

  return (
    <form className="sup-compose" onSubmit={onSubmit}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="action" value="reply" />
      <div className="sup-compose__tools" role="toolbar" aria-label="Formatting">
        <button type="button" className="sup-compose__tool" aria-label="Bold" onClick={() => wrap("**")}>
          <Bold size={14} />
        </button>
        <button type="button" className="sup-compose__tool" aria-label="Italic" onClick={() => wrap("_")}>
          <Italic size={14} />
        </button>
        <button type="button" className="sup-compose__tool" aria-label="Bulleted list" onClick={() => insertLine("- ")}>
          <List size={14} />
        </button>
        <button type="button" className="sup-compose__tool" aria-label="Numbered list" onClick={() => insertLine("1. ")}>
          <ListOrdered size={14} />
        </button>
        <button type="button" className="sup-compose__tool" aria-label="Insert link" onClick={insertLink}>
          <Link2 size={14} />
        </button>
        <span className="sup-compose__tools-hint" title="Stored as plain text with markdown markers">
          Plain text
        </span>
      </div>
      <textarea
        ref={taRef}
        name="body"
        maxLength={4000}
        required
        placeholder="Type your response…"
        aria-label="Reply"
        disabled={pending}
      />
      <div className="sup-compose__flags">
        <label className="sup-compose__check">
          <input type="checkbox" name="internal" disabled={pending} /> Internal note
        </label>
        <label className="sup-compose__check">
          <input type="checkbox" name="awaiting" disabled={pending} /> Needs dealer response
        </label>
      </div>
      <div className="sup-compose__row">
        <span className="sup-compose__attach" title="Staff attachment upload is not available yet">
          <button type="button" className="sup-compose__tool" disabled aria-label="Attach file">
            <Paperclip size={14} />
          </button>
          <button type="button" className="sup-compose__tool" disabled aria-label="Attach image">
            <ImageIcon size={14} />
          </button>
        </span>
        <button className="so-btn so-btn--gold" type="submit" disabled={pending}>
          <MessageCircle size={14} /> {pending ? "Sending…" : "Send Reply"}
        </button>
      </div>
      {error ? <p className="sup-compose__error">{error}</p> : null}
    </form>
  );
}
