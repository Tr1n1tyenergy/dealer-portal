"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  Download,
  FileText,
  Mail,
  MapPin,
  MessageSquarePlus,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  UserRound,
} from "lucide-react";
import { getPusherClient, pusherClientConfigured } from "@/lib/pusher/client";
import { conversationChannel } from "@/lib/pusher/server-channels";
import "./messaging.css";

type PeerInfo = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  department?: string;
  accountType: string;
  lastLoginAt?: string | null;
  dealerOrganizationId?: string | null;
  organizationName?: string | null;
  stationLabel?: string | null;
  stationCode?: string | null;
  locationHint?: string | null;
};

type ConversationRow = {
  id: string;
  displayName: string;
  peer: PeerInfo | null;
  lastMessage: { id: string; body: string; createdAt: string; senderId: string } | null;
  lastMessageAt: string | null;
  lastReadAt?: string | null;
  unreadCount?: number;
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

type ContextOrder = {
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  station: string;
};

type ContextFile = {
  id: string;
  source: string;
  fileName: string;
  kind: string;
  createdAt: string;
  orderId: string;
  orderReference: string;
  downloadPath: string;
};

type ConversationContext = {
  displayName: string;
  peer: PeerInfo | null;
  recentOrders: ContextOrder[];
  files: ContextFile[];
};

type FilterTab = "all" | "dealers" | "internal" | "unread";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Fixed locale so SSR (Node) and the browser never disagree on 12h vs 24h. */
const TIME_LOCALE = "en-GB";
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
const DAY_OPTS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const DAY_YEAR_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(TIME_LOCALE, TIME_OPTS);
  } catch {
    return "";
  }
}

function formatListTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString(TIME_LOCALE, TIME_OPTS);
    return d.toLocaleDateString(TIME_LOCALE, DAY_OPTS);
  } catch {
    return "";
  }
}

function formatDateSeparator(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const timePart = d.toLocaleDateString(TIME_LOCALE, DAY_YEAR_OPTS);
    if (d.toDateString() === today.toDateString()) return `Today, ${timePart}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timePart}`;
    return timePart;
  } catch {
    return "";
  }
}

function dayKey(iso: string) {
  try {
    return new Date(iso).toDateString();
  } catch {
    return iso;
  }
}

function isRecentlyActive(lastLoginAt?: string | null) {
  if (!lastLoginAt) return false;
  const t = new Date(lastLoginAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 15 * 60 * 1000;
}

function statusTone(label: string) {
  const l = label.toLowerCase();
  if (l.includes("quotation")) return "blue";
  if (l.includes("pfi")) return "slate";
  if (l.includes("transit") || l.includes("dispatch")) return "green";
  if (l.includes("payment") || l.includes("awaiting")) return "gold";
  if (l.includes("deliver")) return "teal";
  return "muted";
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

const EMOJIS = ["😊", "👍", "🙏", "🔥", "✅", "⛽"];

function normalizeConversations(
  rows: Array<
    ConversationRow & {
      lastMessageAt?: string | Date | null;
      lastReadAt?: string | Date | null;
      lastMessage?: { id: string; body: string; createdAt: string | Date; senderId: string } | null;
      peer?: (PeerInfo & { lastLoginAt?: string | Date | null }) | null;
    }
  >
): ConversationRow[] {
  return rows.map((c) => ({
    ...c,
    lastMessageAt: c.lastMessageAt ? String(c.lastMessageAt) : null,
    lastReadAt: c.lastReadAt ? String(c.lastReadAt) : null,
    lastMessage: c.lastMessage
      ? { ...c.lastMessage, createdAt: String(c.lastMessage.createdAt) }
      : null,
    peer: c.peer
      ? {
          ...c.peer,
          lastLoginAt: c.peer.lastLoginAt ? String(c.peer.lastLoginAt) : null,
          locationHint:
            c.peer.locationHint ??
            c.peer.stationLabel ??
            c.peer.organizationName ??
            c.peer.department ??
            null,
        }
      : null,
    unreadCount: c.unreadCount ?? 0,
  }));
}

export function MessagingApp({
  variant = "staff",
  initialConversations = [],
}: {
  variant?: "staff" | "dealer";
  initialConversations?: ConversationRow[];
}) {
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";
  /** Dealer portal uses the same full UI as staff; only deep-links differ. */
  const isDealerPortal = variant === "dealer";

  const [conversations, setConversations] = useState<ConversationRow[]>(() =>
    normalizeConversations(initialConversations)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [typingLabel, setTypingLabel] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "context">("list");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fileNotice, setFileNotice] = useState("");
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");

  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const activeName = activeConversation?.displayName ?? context?.displayName ?? "Chat";
  const activePeer = context?.peer ?? activeConversation?.peer ?? null;
  const online = isRecentlyActive(activePeer?.lastLoginAt);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "dealers" && c.peer?.accountType !== "DEALER") return false;
      if (filter === "internal" && c.peer?.accountType !== "INTERNAL") return false;
      if (filter === "unread" && !(c.unreadCount && c.unreadCount > 0)) return false;
      if (!q) return true;
      const hay = [
        c.displayName,
        c.peer?.firstName,
        c.peer?.lastName,
        c.peer?.organizationName,
        c.peer?.stationLabel,
        c.lastMessage?.body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, filter, search]);

  const visibleMessages = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.body.toLowerCase().includes(q));
  }, [messages, threadQuery]);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/messaging/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(normalizeConversations(data.conversations ?? []));
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(
        (data.messages ?? []).map((m: MessageRow) => ({
          ...m,
          createdAt: String(m.createdAt),
        }))
      );
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadContext = useCallback(async (conversationId: string) => {
    setContextLoading(true);
    try {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/context`);
      if (!res.ok) return;
      const data = await res.json();
      setContext({
        displayName: data.displayName,
        peer: data.peer
          ? {
              ...data.peer,
              lastLoginAt: data.peer.lastLoginAt ? String(data.peer.lastLoginAt) : null,
            }
          : null,
        recentOrders: (data.recentOrders ?? []).map((o: ContextOrder) => ({
          ...o,
          createdAt: String(o.createdAt),
        })),
        files: (data.files ?? []).map((f: ContextFile) => ({
          ...f,
          createdAt: String(f.createdAt),
        })),
      });
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => {
    // Refresh in background; SSR already painted the list when available
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setContext(null);
      setMessagesLoading(false);
      return;
    }

    // Paint peer/contact immediately from the list while messages/context fetch
    const seed = conversations.find((c) => c.id === activeId);
    if (seed) {
      setContext({
        displayName: seed.displayName,
        peer: seed.peer
          ? {
              ...seed.peer,
              locationHint:
                seed.peer.locationHint ??
                seed.peer.stationLabel ??
                seed.peer.organizationName ??
                seed.peer.department ??
                null,
            }
          : null,
        recentOrders: [],
        files: [],
      });
    }

    void loadMessages(activeId);
    void loadContext(activeId);
    // intentionally only re-run when activeId changes (seed from current conversations)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, loadMessages, loadContext]);

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
    setMobilePane("chat");
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
    setEmojiOpen(false);
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

  function selectConversation(id: string) {
    setActiveId(id);
    setThreadQuery("");
    setThreadSearchOpen(false);
    setMobilePane("chat");
  }

  function peerSubtitle(c: ConversationRow) {
    if (!c.peer) return "Conversation";
    if (c.peer.accountType === "DEALER") {
      return `Dealer · ${c.peer.stationLabel || c.peer.organizationName || "Station"}`;
    }
    return `Internal · ${c.peer.department || "Team"}`;
  }

  const ordersHref = isDealerPortal
    ? "/dealer/orders"
    : "/intelligence/retail/orders";
  const profileHref = isDealerPortal ? "/dealer/dashboard" : "/intelligence/retail/users";

  return (
    <div className={`msg-app msg-app--staff msg-app--pane-${mobilePane}`}>
      {/* LEFT — Conversations */}
      <aside className="msg-sidebar" style={{ background: "#122a4a" }}>
        <div className="msg-sidebar__head">
          <h2>Conversations</h2>
          <button type="button" className="msg-sidebar__new" onClick={() => void openDirectory()}>
            <MessageSquarePlus size={15} strokeWidth={2} />
            New Chat
          </button>
        </div>

        <div className="msg-search">
          <Search size={15} strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
          />
        </div>
        <div className="msg-filters" role="tablist" aria-label="Conversation filters">
          {(
            [
              ["all", "All"],
              ["dealers", "Dealers"],
              ["internal", "Internal"],
              ["unread", "Unread"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? "is-active" : undefined}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="msg-list">
          {filteredConversations.length === 0 ? (
            <div className="msg-list__empty">
              {conversations.length === 0
                ? "No conversations yet. Start one with New Chat."
                : "No conversations match this filter."}
            </div>
          ) : (
            filteredConversations.map((c) => {
              const dealer = c.peer?.accountType === "DEALER";
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`msg-list__item ${activeId === c.id ? "is-active" : ""}`}
                  onClick={() => selectConversation(c.id)}
                >
                  <span className={`msg-avatar ${dealer ? "msg-avatar--station" : ""}`}>
                    {dealer ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/assets2/img/retail/dashboard-hero-station.jpg" alt="" />
                    ) : (
                      initials(c.displayName)
                    )}
                  </span>
                  <span className="msg-list__meta">
                    <span className="msg-list__top">
                      <span className="msg-list__name">{c.displayName}</span>
                      <span className="msg-list__time">{formatListTime(c.lastMessageAt)}</span>
                    </span>
                    <span className="msg-list__kind">{peerSubtitle(c)}</span>
                    <span className="msg-list__preview">
                      {c.lastMessage?.body ?? "No messages yet"}
                    </span>
                  </span>
                  {c.unreadCount && c.unreadCount > 0 ? (
                    <span className="msg-list__unread">{c.unreadCount > 9 ? "9+" : c.unreadCount}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* CENTER — Thread */}
      <section className="msg-thread" style={{ background: "#122a4a" }}>
        {!activeId ? (
          <div className="msg-thread__empty">
            <div className="msg-thread__empty-card">
              <MessageSquarePlus size={28} strokeWidth={1.5} />
              <strong>Select a chat or start a new conversation</strong>
              <span>Dealer and internal conversations appear here in real time.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="msg-thread__head">
              <button
                type="button"
                className="msg-back"
                onClick={() => setMobilePane("list")}
                aria-label="Back to conversations"
              >
                ←
              </button>
              <span className={`msg-avatar ${activePeer?.accountType === "DEALER" ? "msg-avatar--station" : ""}`}>
                {activePeer?.accountType === "DEALER" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/assets2/img/retail/dashboard-hero-station.jpg" alt="" />
                ) : (
                  initials(activeName)
                )}
              </span>
              <div className="msg-thread__identity">
                <strong>{activeName}</strong>
                <span className={online ? "is-online" : undefined}>
                  {online ? (
                    <>
                      <i /> Online
                    </>
                  ) : activePeer?.lastLoginAt ? (
                    `Last active ${formatListTime(String(activePeer.lastLoginAt))}`
                  ) : (
                    "Conversation"
                  )}
                </span>
              </div>
              <div className="msg-thread__actions">
                <button
                  type="button"
                  aria-label="Search in conversation"
                  className={threadSearchOpen ? "is-on" : undefined}
                  onClick={() => setThreadSearchOpen((v) => !v)}
                >
                  <Search size={16} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Call unavailable"
                  disabled
                  title="No phone number on file for this contact"
                >
                  <Phone size={16} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Open contact details"
                  onClick={() => setMobilePane("context")}
                >
                  <MoreVertical size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {threadSearchOpen ? (
              <div className="msg-thread__search">
                <Search size={14} />
                <input
                  value={threadQuery}
                  onChange={(e) => setThreadQuery(e.target.value)}
                  placeholder="Search messages..."
                  autoFocus
                />
              </div>
            ) : null}

            <div className="msg-thread__body" ref={bodyRef}>
              {visibleMessages.length === 0 ? (
                <div className="msg-thread__none">
                  {threadQuery
                    ? "No messages match your search."
                    : messagesLoading
                      ? "Loading messages…"
                      : "No messages yet. Say hello."}
                </div>
              ) : (
                visibleMessages.map((m, idx) => {
                  const mine = m.senderId === myId;
                  const showDay =
                    idx === 0 || dayKey(m.createdAt) !== dayKey(visibleMessages[idx - 1]!.createdAt);
                  const senderName = m.sender
                    ? `${m.sender.firstName} ${m.sender.lastName}`
                    : activeName;
                  return (
                    <div key={m.id} className="msg-day-block">
                      {showDay ? (
                        <div className="msg-day">
                          <span>{formatDateSeparator(m.createdAt)}</span>
                        </div>
                      ) : null}
                      <div
                        className={`msg-row ${mine ? "msg-row--mine" : "msg-row--theirs"}`}
                      >
                        {!mine ? (
                          <span
                            className={`msg-avatar msg-avatar--sm ${
                              activePeer?.accountType === "DEALER" ? "msg-avatar--station" : ""
                            }`}
                          >
                            {activePeer?.accountType === "DEALER" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src="/assets2/img/retail/dashboard-hero-station.jpg" alt="" />
                            ) : (
                              initials(senderName)
                            )}
                          </span>
                        ) : null}
                        <div
                          className={`msg-bubble ${mine ? "msg-bubble--mine" : "msg-bubble--theirs"}`}
                        >
                          <div className="msg-bubble__text">{m.body}</div>
                          <div className="msg-bubble__time">
                            <span>{formatTime(m.createdAt)}</span>
                            {receiptTicks(m, myId)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="msg-typing">{typingLabel || fileNotice}</div>

            <div className="msg-composer">
              <button
                type="button"
                className="msg-composer__icon"
                disabled
                title="Message attachments are not available yet. Shared order files appear in the side panel."
                aria-label="Attachments unavailable"
              >
                <Paperclip size={18} strokeWidth={1.75} />
              </button>
              <textarea
                ref={composerRef}
                value={draft}
                rows={1}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message..."
              />
              <div className="msg-composer__emoji-wrap">
                <button
                  type="button"
                  className="msg-composer__icon"
                  aria-label="Insert emoji"
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <Smile size={18} strokeWidth={1.75} />
                </button>
                {emojiOpen ? (
                  <div className="msg-emoji-pop" role="listbox">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          onDraftChange(draft + e);
                          setEmojiOpen(false);
                          composerRef.current?.focus();
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="msg-composer__send"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                aria-label="Send message"
              >
                <Send size={16} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </section>

      {/* RIGHT — Contact intelligence */}
      <aside
        className="msg-context"
        style={{ background: "#122a4a", paddingTop: 24, overflow: "auto" }}
      >
          {!activeId ? (
            <div className="msg-context__empty">
              <strong>Contact intelligence</strong>
              <span>Select a conversation to view dealer details, orders, and shared files.</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="msg-back msg-back--context"
                onClick={() => setMobilePane("chat")}
                aria-label="Back to chat"
              >
                ← Back to chat
              </button>

              <div className="msg-profile" style={{ paddingTop: 8, borderBottom: "1px solid rgba(22,135,255,0.16)" }}>
                <div
                  className="msg-profile__body"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "20px 16px 8px",
                    gap: 4,
                  }}
                >
                  <span
                    className={`msg-avatar msg-avatar--lg ${
                      activePeer?.accountType === "DEALER" ? "msg-avatar--station" : ""
                    }`}
                    style={{
                      width: 64,
                      height: 64,
                      marginTop: 0,
                      flexShrink: 0,
                      borderRadius: 999,
                      overflow: "hidden",
                      border: "2px solid rgba(22,135,255,0.45)",
                    }}
                  >
                    {activePeer?.accountType === "DEALER" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/assets2/img/retail/dashboard-hero-station.jpg" alt="" />
                    ) : (
                      initials(activeName)
                    )}
                  </span>
                  <strong>{activeName}</strong>
                  <span className={online ? "is-online" : undefined}>
                    {online ? (
                      <>
                        <i /> Online
                      </>
                    ) : (
                      "Away"
                    )}
                  </span>
                  <em>
                    {activePeer?.accountType === "DEALER" ? "Dealer Account" : "Internal Account"}
                  </em>
                  <span className="msg-profile__loc">
                    <MapPin size={13} strokeWidth={1.75} />
                    {activePeer?.locationHint ||
                      activePeer?.organizationName ||
                      activePeer?.department ||
                      "Trinity Energy"}
                  </span>
                </div>

                <div className="msg-profile__actions">
                  <button
                    type="button"
                    className="is-disabled"
                    disabled
                    title="No phone number on file for this contact"
                  >
                    <Phone size={15} />
                    Call
                  </button>
                  {activePeer?.email ? (
                    <a href={`mailto:${activePeer.email}`} title={`Email ${activePeer.email}`}>
                      <Mail size={15} />
                      Email
                    </a>
                  ) : (
                    <button type="button" className="is-disabled" disabled title="No email on file">
                      <Mail size={15} />
                      Email
                    </button>
                  )}
                  <Link href={profileHref} title={isDealerPortal ? "Open account" : "Open Users"}>
                    <UserRound size={15} />
                    View Profile
                  </Link>
                </div>
              </div>

              <section className="msg-card">
                <header className="msg-card__head">
                  <span>
                    <CalendarDays size={15} strokeWidth={1.75} />
                    Recent Orders
                  </span>
                  <Link href={ordersHref}>View all →</Link>
                </header>
                <div className="msg-card__body">
                  {contextLoading && (context?.recentOrders ?? []).length === 0 ? (
                    <p className="msg-card__empty">Loading orders…</p>
                  ) : (context?.recentOrders ?? []).length === 0 ? (
                    <p className="msg-card__empty">No recent orders for this contact.</p>
                  ) : (
                    context!.recentOrders.map((o) => (
                      <Link
                        key={o.id}
                        href={isDealerPortal ? `/dealer/orders/${o.id}` : ordersHref}
                        className="msg-order"
                      >
                        <span className="msg-order__icon">
                          <FileText size={14} />
                        </span>
                        <span className="msg-order__ref">{o.reference}</span>
                        <span className={`msg-pill msg-pill--${statusTone(o.statusLabel)}`}>
                          {o.statusLabel}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="msg-card">
                <header className="msg-card__head">
                  <span>
                    <FileText size={15} strokeWidth={1.75} />
                    Shared Files
                  </span>
                  <Link href={ordersHref}>View all →</Link>
                </header>
                <div className="msg-card__body">
                  {contextLoading && (context?.files ?? []).length === 0 ? (
                    <p className="msg-card__empty">Loading files…</p>
                  ) : (context?.files ?? []).length === 0 ? (
                    <p className="msg-card__empty">No shared documents yet.</p>
                  ) : (
                    context!.files.map((f) => (
                      <div key={`${f.source}-${f.id}`} className="msg-file">
                        <span className="msg-file__icon" aria-hidden>
                          PDF
                        </span>
                        <div className="msg-file__meta">
                          <strong>{f.fileName}</strong>
                          <span>
                            {f.kind} · {formatListTime(f.createdAt)} · {f.orderReference}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="msg-file__dl"
                          aria-label={`Download ${f.fileName}`}
                          onClick={() => {
                            void (async () => {
                              setFileNotice("");
                              try {
                                const url = `${f.downloadPath}${
                                  activeId ? `?conversationId=${activeId}` : ""
                                }`;
                                const res = await fetch(url);
                                if (!res.ok) {
                                  setFileNotice("File is not available on this server.");
                                  setTimeout(() => setFileNotice(""), 4000);
                                  return;
                                }
                                const blob = await res.blob();
                                const objectUrl = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = objectUrl;
                                a.download = f.fileName;
                                a.click();
                                URL.revokeObjectURL(objectUrl);
                              } catch {
                                setFileNotice("Could not download file.");
                                setTimeout(() => setFileNotice(""), 4000);
                              }
                            })();
                          }}
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
      </aside>

      {directoryOpen ? (
        <div className="msg-directory" role="dialog" aria-modal aria-label="Start conversation">
          <div className="msg-directory__panel">
            <h3>Start conversation</h3>
            <p className="msg-directory__hint">Choose an eligible contact to open a direct chat.</p>
            <button
              type="button"
              className="msg-directory__cancel"
              onClick={() => setDirectoryOpen(false)}
            >
              Cancel
            </button>
            <div className="msg-directory__list">
              {directory.length === 0 ? (
                <p className="msg-directory__empty">No contacts available.</p>
              ) : (
                directory.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="msg-directory__row"
                    onClick={() => void startChat(u.id)}
                  >
                    <span className="msg-avatar msg-avatar--sm">{initials(u.displayName)}</span>
                    <span>
                      <strong>{u.displayName}</strong>
                      <em>{u.accountType === "DEALER" ? "Dealer" : "Internal"}</em>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
