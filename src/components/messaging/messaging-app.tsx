"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getPusherClient, pusherClientConfigured } from "@/lib/pusher/client";
import { conversationChannel } from "@/lib/pusher/server-channels";
import "./messaging.css";

type ConversationRow = {
  id: string;
  displayName: string;
  lastMessage: { id: string; body: string; createdAt: string; senderId: string } | null;
  lastMessageAt: string | null;
};

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  receipts?: { userId: string; status: string }[];
  sender?: { id: string; firstName: string; lastName: string };
};

type DirectoryUser = {
  id: string;
  displayName: string;
  accountType: string;
  firstName: string;
  lastName: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function receiptTicks(msg: MessageRow, myId: string) {
  if (msg.senderId !== myId) return null;
  const others = (msg.receipts ?? []).filter((r) => r.userId !== myId);
  if (!others.length) return <span className="msg-ticks">✓</span>;
  const allRead = others.every((r) => r.status === "READ");
  const allDelivered = others.every((r) => r.status === "DELIVERED" || r.status === "READ");
  if (allRead) return <span className="msg-ticks is-read">✓✓</span>;
  if (allDelivered) return <span className="msg-ticks">✓✓</span>;
  return <span className="msg-ticks">✓</span>;
}

export function MessagingApp({ variant = "staff" }: { variant?: "staff" | "dealer" }) {
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [typingLabel, setTypingLabel] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeName = useMemo(
    () => conversations.find((c) => c.id === activeId)?.displayName ?? "Chat",
    [conversations, activeId]
  );

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/messaging/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(
      (data.conversations ?? []).map((c: ConversationRow & { lastMessageAt?: string | Date }) => ({
        ...c,
        lastMessageAt: c.lastMessageAt ? String(c.lastMessageAt) : null,
        lastMessage: c.lastMessage
          ? { ...c.lastMessage, createdAt: String(c.lastMessage.createdAt) }
          : null,
      }))
    );
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(
      (data.messages ?? []).map((m: MessageRow) => ({
        ...m,
        createdAt: String(m.createdAt),
      }))
    );
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, typingLabel]);

  useEffect(() => {
    if (!activeId || !pusherClientConfigured()) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channelName = conversationChannel(activeId);
    const channel = pusher.subscribe(channelName);

    channel.bind("message:new", (payload: { message: MessageRow }) => {
      const msg = {
        ...payload.message,
        createdAt: String(payload.message.createdAt),
      };
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      void loadConversations();
    });

    channel.bind("typing", (payload: { userId: string; isTyping: boolean; name?: string }) => {
      if (payload.userId === myId) return;
      setTypingLabel(payload.isTyping ? `${payload.name || "Someone"} is typing…` : "");
    });

    channel.bind(
      "receipt:update",
      (payload: { userId: string; status: string; messageIds: string[] }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (!payload.messageIds.includes(m.id)) return m;
            const receipts = (m.receipts ?? []).map((r) =>
              r.userId === payload.userId ? { ...r, status: payload.status } : r
            );
            return { ...m, receipts };
          })
        );
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeId, myId, loadConversations]);

  async function openDirectory() {
    setDirectoryOpen(true);
    const res = await fetch("/api/messaging/directory");
    if (res.ok) {
      const data = await res.json();
      setDirectory(data.users ?? []);
    }
  }

  async function startChat(peerUserId: string) {
    const res = await fetch("/api/messaging/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerUserId }),
    });
    setDirectoryOpen(false);
    if (!res.ok) return;
    const data = await res.json();
    await loadConversations();
    setActiveId(data.conversationId);
  }

  async function notifyTyping(isTyping: boolean) {
    if (!activeId) return;
    await fetch("/api/messaging/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeId, isTyping }),
    }).catch(() => undefined);
  }

  function onDraftChange(value: string) {
    setDraft(value);
    void notifyTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => void notifyTyping(false), 1200);
  }

  async function send() {
    if (!activeId || !draft.trim() || sending) return;
    const body = draft.trim();
    setDraft("");
    setSending(true);
    void notifyTyping(false);
    const optimistic: MessageRow = {
      id: `tmp-${Date.now()}`,
      conversationId: activeId,
      senderId: myId,
      body,
      createdAt: new Date().toISOString(),
      receipts: [{ userId: myId, status: "READ" }],
    };
    setMessages((prev) => [...prev, optimistic]);
    const res = await fetch(`/api/messaging/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      return;
    }
    const data = await res.json();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === optimistic.id
          ? { ...data.message, createdAt: String(data.message.createdAt) }
          : m
      )
    );
    await loadConversations();
  }

  return (
    <div className={`msg-app ${variant === "dealer" ? "msg-app--dealer" : ""}`}>
      <aside className="msg-sidebar">
        <div className="msg-sidebar__head">
          <h2>Chats</h2>
          <button type="button" className="msg-sidebar__new" onClick={() => void openDirectory()}>
            New
          </button>
        </div>
        <div className="msg-list">
          {conversations.length === 0 ? (
            <p style={{ padding: "1rem", color: "var(--msg-muted)", fontSize: "0.85rem" }}>
              No conversations yet. Start one with New.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`msg-list__item ${activeId === c.id ? "is-active" : ""}`}
                onClick={() => setActiveId(c.id)}
              >
                <span className="msg-avatar">{initials(c.displayName)}</span>
                <span className="msg-list__meta">
                  <span className="msg-list__name">{c.displayName}</span>
                  <span className="msg-list__preview">{c.lastMessage?.body ?? "No messages yet"}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="msg-thread">
        {!activeId ? (
          <div className="msg-thread__empty">Select a chat or start a new conversation.</div>
        ) : (
          <>
            <div className="msg-thread__head">{activeName}</div>
            <div className="msg-thread__body" ref={bodyRef}>
              {messages.map((m) => {
                const mine = m.senderId === myId;
                return (
                  <div
                    key={m.id}
                    className={`msg-bubble ${mine ? "msg-bubble--mine" : "msg-bubble--theirs"}`}
                  >
                    <div>{m.body}</div>
                    <div className="msg-bubble__time">
                      <span>{formatTime(m.createdAt)}</span>
                      {receiptTicks(m, myId)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="msg-typing">{typingLabel}</div>
            <div className="msg-composer">
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message"
              />
              <button type="button" onClick={() => void send()} disabled={sending || !draft.trim()}>
                Send
              </button>
            </div>
          </>
        )}
      </section>

      {directoryOpen ? (
        <div className="msg-directory" role="dialog" aria-modal>
          <div className="msg-directory__panel">
            <h3>Start conversation</h3>
            <button
              type="button"
              className="msg-directory__row"
              onClick={() => setDirectoryOpen(false)}
              style={{ fontWeight: 700 }}
            >
              Cancel
            </button>
            {directory.map((u) => (
              <button
                key={u.id}
                type="button"
                className="msg-directory__row"
                onClick={() => void startChat(u.id)}
              >
                {u.displayName}{" "}
                <span style={{ color: "var(--msg-muted)", fontSize: "0.75rem" }}>
                  ({u.accountType})
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
