"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudUpload,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileText,
  Flag,
  Handshake,
  Headphones,
  Info,
  Layers,
  Lightbulb,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  MoreVertical,
  Paperclip,
  Pencil,
  Phone,
  PlusSquare,
  RefreshCw,
  Search,
  Send,
  Settings,
  Tag,
  Ticket,
  TicketPlus,
  Truck,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  DEPARTMENT_LABELS,
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  supportFilesFit,
  MAX_SUPPORT_DESCRIPTION,
  MAX_SUPPORT_SUBJECT,
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_DEPARTMENTS,
  SUPPORT_PRIORITIES,
  type SupportDepartment,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support/constants";
import {
  FAQ_CATEGORIES,
  filterFaqs,
  type FaqCategory,
  type FaqIconId,
} from "@/lib/support/faq-data";
import { SUPPORT_CONTACT } from "@/components/dealer/support-card";
import { DealerHeroMedia } from "@/components/dealer/dealer-hero-media";
import "@/app/dealer/dealer-support.css";
import "@/app/dealer/dealer-portal-hero.css";

export type SupportSection = "tickets" | "new" | "faq" | "contact";

type TicketRow = {
  id: string;
  reference: string;
  subject: string;
  department: SupportDepartment;
  priority: SupportPriority;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
};

type Counts = {
  total: number;
  byStatus: Record<SupportStatus, number>;
};

type DealerIdentity = {
  fullName: string;
  email: string;
  organizationName: string;
};

type OrderOption = { id: string; reference: string };

const TIME_LOCALE = "en-GB";

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString(TIME_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
    if (sameDay) return `Today, ${time}`;
    return `${d.toLocaleDateString(TIME_LOCALE, { day: "numeric", month: "short" })}, ${time}`;
  } catch {
    return "";
  }
}

function deptIcon(dept: SupportDepartment) {
  if (dept === "IT") return <Monitor size={14} />;
  if (dept === "FINANCE") return <Wallet size={14} />;
  if (dept === "SALES") return <Handshake size={14} />;
  if (dept === "SUPPLY") return <Truck size={14} />;
  return <Settings size={14} />;
}

export function SupportCentre({
  identity,
  orders,
  initialSection = "tickets",
  initialDepartment,
}: {
  identity: DealerIdentity;
  orders: OrderOption[];
  initialSection?: SupportSection;
  initialDepartment?: SupportDepartment;
}) {
  const router = useRouter();
  const [section, setSection] = useState<SupportSection>(initialSection);
  const [raiseDepartment, setRaiseDepartment] = useState<SupportDepartment | "">(
    initialDepartment ?? "",
  );
  const hero =
    section === "tickets"
      ? {
          kicker: "SUPPORT CENTRE",
          title: "My Tickets",
          subtitle: "Track, manage and communicate on all your support requests.",
        }
      : section === "new"
        ? {
            kicker: "SUPPORT CENTRE",
            title: "Raise a Ticket",
            subtitle: "Tell us what you need — our team will follow up on your request.",
          }
        : section === "faq"
          ? {
              kicker: "SUPPORT CENTRE",
              title: "FAQs",
              subtitle: "Get help, find answers and keep your business moving.",
            }
          : {
              kicker: "SUPPORT CENTRE",
              title: "Contact Trinity",
              subtitle: "Get help, find answers and keep your business moving.",
            };
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    byStatus: { OPEN: 0, IN_PROGRESS: 0, AWAITING_RESPONSE: 0, RESOLVED: 0, CLOSED: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [statusTab, setStatusTab] = useState<SupportStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState<{ reference: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(false);
    try {
      const params = new URLSearchParams({
        status: statusTab,
        department: "ALL",
        dateRange: "ALL",
        q,
      });
      const [listRes, countRes] = await Promise.all([
        fetch(`/api/support/tickets?${params}`),
        fetch("/api/support/tickets/counts"),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setTickets(data.tickets ?? []);
      } else {
        setListError(true);
      }
      if (countRes.ok) {
        const data = await countRes.json();
        setCounts(data);
      }
    } catch {
      setListError(true);
    } finally {
      setLoading(false);
    }
  }, [statusTab, q, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function syncUrl(next: SupportSection, dept?: SupportDepartment | "") {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "tickets") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    if (next === "new" && dept) url.searchParams.set("department", dept);
    else url.searchParams.delete("department");
    window.history.replaceState({}, "", url.pathname + url.search);
  }

  function goSection(next: SupportSection) {
    if (next !== "new") setRaiseDepartment("");
    setSection(next);
    syncUrl(next, next === "new" ? raiseDepartment : "");
  }

  function goNew(dept?: SupportDepartment) {
    const nextDept = dept ?? "";
    setRaiseDepartment(nextDept);
    setSection("new");
    syncUrl("new", nextDept);
  }

  function handleCreated(ticket: { id: string; reference: string }) {
    setFlash({ reference: ticket.reference });
    setHighlightId(ticket.id);
    setStatusTab("ALL");
    setQ("");
    setSection("tickets");
    syncUrl("tickets");
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="ds">
      <section className="ds__hero">
        <DealerHeroMedia />
        <div className="ds__hero-veil" aria-hidden />
        <div className="ds__hero-inner">
          <div className="ds__hero-copy">
            <span className="ds__hero-accent" aria-hidden />
            <div>
              <p className="ds__hero-kicker">{hero.kicker}</p>
              <h1>{hero.title}</h1>
              <p>{hero.subtitle}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="ds__workspace">
      <nav className="ds__nav" aria-label="Support sections">
        <button type="button" className="ds__nav-cta" onClick={() => goNew()}>
          <PlusSquare size={16} strokeWidth={2} />
          Raise a New Ticket
        </button>
        <button
          type="button"
          className={`ds__nav-item ${section === "tickets" ? "is-active" : ""}`}
          onClick={() => goSection("tickets")}
        >
          <Ticket size={16} strokeWidth={2} />
          My Tickets
          <span className="ds__nav-badge">{counts.total}</span>
        </button>
        <button
          type="button"
          className={`ds__nav-item ds__nav-item--wrap ${section === "faq" ? "is-active" : ""}`}
          onClick={() => goSection("faq")}
        >
          <CircleHelp size={16} strokeWidth={2} />
          <span>
            Frequently Asked
            <br />
            Questions
          </span>
        </button>
        <button
          type="button"
          className={`ds__nav-item ${section === "contact" ? "is-active" : ""}`}
          onClick={() => goSection("contact")}
        >
          <Phone size={16} strokeWidth={2} />
          Contact Trinity
        </button>
      </nav>

      <section className="ds__main">
        {section === "tickets" ? (
          <TicketsPanel
            tickets={tickets}
            counts={counts}
            loading={loading}
            listError={listError}
            statusTab={statusTab}
            setStatusTab={setStatusTab}
            q={q}
            setQ={setQ}
            flash={flash}
            onDismissFlash={() => setFlash(null)}
            highlightId={highlightId}
            onRaise={() => goNew()}
            onRetry={() => void load()}
            onOpen={(id) => router.push(`/dealer/support/tickets/${id}`)}
          />
        ) : null}
        {section === "new" ? (
          <RaiseTicketForm
            key={raiseDepartment || "blank"}
            identity={identity}
            orders={orders}
            initialDepartment={raiseDepartment || undefined}
            onCancel={() => goSection("tickets")}
            onCreated={handleCreated}
          />
        ) : null}
        {section === "faq" ? <FaqPanel onRaise={() => goNew()} /> : null}
        {section === "contact" ? (
          <ContactPanel onRaise={() => goNew()} onRaiseDepartment={goNew} />
        ) : null}
      </section>

      <aside className="ds__aside">
        {section === "new" ? (
          <RaiseAside />
        ) : section === "faq" ? (
          <FaqAside onRaise={() => goNew()} onContact={() => goSection("contact")} />
        ) : section === "contact" ? (
          <ContactAside />
        ) : (
          <TicketsAside counts={counts} />
        )}
      </aside>
      </div>
    </div>
  );
}

function TicketsAside({ counts }: { counts: Counts }) {
  return (
    <>
      <div className="ds__aside-card ds__glance">
        <h3>Support at a Glance</h3>
        <div className="ds__glance-tiles">
          <div className="ds__glance-tile ds__glance-tile--resolved">
            <CheckCircle2 size={18} strokeWidth={2.2} aria-hidden />
            <strong>{counts.byStatus.RESOLVED}</strong>
            <span>Resolved</span>
          </div>
          <div className="ds__glance-tile ds__glance-tile--progress">
            <RefreshCw size={18} strokeWidth={2.2} aria-hidden />
            <strong>{counts.byStatus.IN_PROGRESS}</strong>
            <span>In Progress</span>
          </div>
          <div className="ds__glance-tile ds__glance-tile--awaiting">
            <Clock3 size={18} strokeWidth={2.2} aria-hidden />
            <strong>{counts.byStatus.AWAITING_RESPONSE}</strong>
            <span>Awaiting Response</span>
          </div>
        </div>
      </div>
      <div className="ds__aside-card ds__next">
        <h3>What Happens Next?</h3>
        <ol className="ds__next-list">
          <li>
            <span className="ds__next-step" aria-hidden>
              1
            </span>
            <div>
              <strong>Ticket Submitted</strong>
              <p>Your request is received and a ticket reference is generated.</p>
            </div>
          </li>
          <li>
            <span className="ds__next-step" aria-hidden>
              2
            </span>
            <div>
              <strong>Under Review</strong>
              <p>Our support team reviews and works on it.</p>
            </div>
          </li>
          <li>
            <span className="ds__next-step" aria-hidden>
              3
            </span>
            <div>
              <strong>Resolution</strong>
              <p>We update you and close the ticket once resolved.</p>
            </div>
          </li>
        </ol>
      </div>
    </>
  );
}

function RaiseAside() {
  const departments = [
    {
      key: "IT",
      icon: <Monitor size={16} strokeWidth={2} />,
      title: "IT",
      text: "System access, login, and portal issues",
      tone: "it",
    },
    {
      key: "Finance",
      icon: <Wallet size={16} strokeWidth={2} />,
      title: "Finance",
      text: "Payments, PFIs, invoices and statements",
      tone: "finance",
    },
    {
      key: "Sales",
      icon: <Handshake size={16} strokeWidth={2} />,
      title: "Sales",
      text: "Orders, pricing and account enquiries",
      tone: "sales",
    },
    {
      key: "Supply",
      icon: <Truck size={16} strokeWidth={2} />,
      title: "Supply",
      text: "Deliveries, supply availability and logistics",
      tone: "supply",
    },
  ] as const;

  const priorities: { key: SupportPriority; text: string }[] = [
    { key: "LOW", text: "General enquiry or request." },
    { key: "MEDIUM", text: "Non-urgent, routine issue." },
    { key: "HIGH", text: "Requires prompt attention." },
    { key: "CRITICAL", text: "Service outage or issue severely affecting operations." },
  ];

  return (
    <>
      <div className="ds__aside-card ds__aside-card--guide">
        <div className="ds__guide-head">
          <h3>Ticketing Guide</h3>
          <Info size={16} strokeWidth={2} aria-hidden />
        </div>
        <div className="ds__dept-guide">
          {departments.map((d) => (
            <div key={d.key} className="ds__dept-guide-row">
              <span className={`ds__dept-guide-ico ds__dept-guide-ico--${d.tone}`} aria-hidden>
                {d.icon}
              </span>
              <div>
                <strong>{d.title}</strong>
                <p>{d.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="ds__aside-wave" aria-hidden>
          <svg viewBox="0 0 220 80" preserveAspectRatio="none">
            <path
              d="M0 50 C40 20 70 70 110 40 C150 12 180 55 220 30 L220 80 L0 80 Z"
              fill="rgba(53,81,165,0.1)"
            />
          </svg>
        </div>
      </div>

      <div className="ds__aside-card ds__aside-card--priority">
        <div className="ds__section-title">
          <span className="ds__section-accent" aria-hidden />
          <h3>Priority Levels</h3>
        </div>
        <div className="ds__priority-legend">
          {priorities.map((p) => (
            <div key={p.key} className="ds__priority-legend-row">
              <i className={`ds__priority-dot ds__priority-dot--${p.key}`} aria-hidden />
              <div>
                <strong>{PRIORITY_LABELS[p.key]}</strong>
                <p>{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TicketsPanel({
  tickets,
  counts,
  loading,
  listError,
  statusTab,
  setStatusTab,
  q,
  setQ,
  flash,
  onDismissFlash,
  highlightId,
  onRaise,
  onRetry,
  onOpen,
}: {
  tickets: TicketRow[];
  counts: Counts;
  loading: boolean;
  listError: boolean;
  statusTab: SupportStatus | "ALL";
  setStatusTab: (v: SupportStatus | "ALL") => void;
  q: string;
  setQ: (v: string) => void;
  flash: { reference: string } | null;
  onDismissFlash: () => void;
  highlightId: string | null;
  onRaise: () => void;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tabs: { key: SupportStatus | "ALL"; label: string; count: number }[] = [
    { key: "ALL", label: "All Tickets", count: counts.total },
    { key: "OPEN", label: "Open", count: counts.byStatus.OPEN },
    { key: "IN_PROGRESS", label: "In Progress", count: counts.byStatus.IN_PROGRESS },
    { key: "AWAITING_RESPONSE", label: "Awaiting Response", count: counts.byStatus.AWAITING_RESPONSE },
    { key: "RESOLVED", label: "Resolved", count: counts.byStatus.RESOLVED },
    { key: "CLOSED", label: "Closed", count: counts.byStatus.CLOSED },
  ];

  useEffect(() => {
    setPage(1);
  }, [statusTab, q, pageSize]);

  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuId]);

  const total = tickets.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const pageRows = tickets.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <div className="ds__main-head">
        <div className="ds__main-head__copy">
          <h2>My Tickets ({counts.total})</h2>
          <p>All your support requests and their current status.</p>
        </div>
        <label className="ds__search ds__search--head">
          <Search size={15} strokeWidth={1.75} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ticket no., subject or department..."
            aria-label="Search tickets"
          />
        </label>
      </div>

      {flash ? (
        <div className="ds__flash" role="status">
          <span className="ds__flash-ico" aria-hidden>
            <CheckCircle2 size={18} strokeWidth={2.2} />
          </span>
          <div className="ds__flash-copy">
            <strong>Your support ticket has been submitted successfully!</strong>
            <p>
              Ticket {flash.reference} has been received by our support team. We&apos;ll review your
              request and keep you updated here. You can follow its progress and communicate with our
              team at any time.
            </p>
          </div>
          <button type="button" className="ds__flash-close" onClick={onDismissFlash} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className="ds__tabs" role="tablist" aria-label="Ticket status">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={statusTab === t.key}
            className={`ds__tab ${statusTab === t.key ? "is-active" : ""}`}
            onClick={() => setStatusTab(t.key)}
          >
            <span className="ds__tab-label">{t.label}</span>
            <span className="ds__tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ds__empty">
          <p>Loading tickets…</p>
        </div>
      ) : listError ? (
        <div className="ds__empty">
          <strong>Couldn&apos;t load tickets</strong>
          <p>Please try again. If the problem continues, contact Trinity Support.</p>
          <button type="button" className="ds__btn-outline" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="ds__empty">
          <div className="ds__empty-ico" aria-hidden>
            <Ticket size={28} strokeWidth={1.75} />
          </div>
          <strong>{q || statusTab !== "ALL" ? "No matching tickets" : "No support tickets yet"}</strong>
          <p>
            {q || statusTab !== "ALL"
              ? "Try a different search or status filter."
              : "Raise a ticket when you need help with orders, PFIs, payments, or account access."}
          </p>
          {!q && statusTab === "ALL" ? (
            <button type="button" className="ds__btn-yellow" onClick={onRaise}>
              <TicketPlus size={16} />
              Raise a New Ticket
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="ds__table-wrap">
            <table className="ds__table">
              <thead>
                <tr>
                  <th>Ticket No.</th>
                  <th>Subject</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => (
                  <tr
                    key={t.id}
                    className={highlightId === t.id ? "is-highlight" : undefined}
                    onClick={() => onOpen(t.id)}
                  >
                    <td>
                      <span className="ds__ref">{t.reference}</span>
                    </td>
                    <td>
                      <span className="ds__subject">{t.subject}</span>
                    </td>
                    <td>
                      <span className="ds__dept">
                        {deptIcon(t.department)}
                        {DEPARTMENT_LABELS[t.department]}
                      </span>
                    </td>
                    <td>
                      <span className={`ds__pill ds__pill--priority-${t.priority}`}>
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    </td>
                    <td>
                      <span className={`ds__pill ds__pill--status-${t.status}`}>
                        <i className="ds__status-dot" aria-hidden />
                        {STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td>
                      <span className="ds__updated">{formatUpdated(t.updatedAt)}</span>
                    </td>
                    <td className="ds__row-action" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="ds__icon-btn"
                        aria-label={`View ${t.reference}`}
                        onClick={() => onOpen(t.id)}
                      >
                        <Eye size={15} strokeWidth={2.1} />
                      </button>
                      <div className="ds__more" ref={menuId === t.id ? menuRef : undefined}>
                        <button
                          type="button"
                          className="ds__icon-btn"
                          aria-label={`More actions for ${t.reference}`}
                          aria-expanded={menuId === t.id}
                          onClick={() => setMenuId((cur) => (cur === t.id ? null : t.id))}
                        >
                          <MoreVertical size={15} strokeWidth={2.1} />
                        </button>
                        {menuId === t.id ? (
                          <div className="ds__more-menu" role="menu">
                            <button type="button" role="menuitem" onClick={() => onOpen(t.id)}>
                              View ticket
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ds__pager">
            <span>
              Showing {start} – {end} of {total} tickets
            </span>
            <div className="ds__pager-controls">
              <label className="ds__pager-size">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
              <button
                type="button"
                className="ds__page-btn"
                disabled={safePage <= 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="ds__page-current" aria-current="page">
                {safePage}
              </span>
              <button
                type="button"
                className="ds__page-btn"
                disabled={safePage >= pageCount}
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function RaiseTicketForm({
  identity,
  orders,
  initialDepartment,
  onCancel,
  onCreated,
}: {
  identity: DealerIdentity;
  orders: OrderOption[];
  initialDepartment?: SupportDepartment;
  onCancel: () => void;
  onCreated: (ticket: { id: string; reference: string }) => void;
}) {
  const [subject, setSubject] = useState("");
  const [department, setDepartment] = useState<SupportDepartment | "">(initialDepartment ?? "");
  const [priority, setPriority] = useState<SupportPriority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [relatedOrderId, setRelatedOrderId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dirty = Boolean(
    subject.trim() || description.trim() || department || relatedOrderId || files.length,
  );

  function addFiles(list: FileList | File[]) {
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_SUPPORT_ATTACHMENTS) {
        setError(`You can attach up to ${MAX_SUPPORT_ATTACHMENTS} files.`);
        break;
      }
      if (!supportFilesFit([...next, f].map((file) => file.size))) {
        setError(`Files can be ${MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024)} MB in total.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function requestCancel() {
    if (dirty && !window.confirm("Discard this ticket draft and return to My Tickets?")) return;
    onCancel();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nextErrors: Record<string, string> = {};
    if (!department) nextErrors.department = "Select a department.";
    if (!subject.trim()) nextErrors.subject = "Enter a subject.";
    if (description.trim().length < 10) nextErrors.description = "Add a bit more detail (at least 10 characters).";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setPending(true);
    try {
      const form = new FormData();
      form.set("subject", subject);
      form.set("description", description);
      form.set("department", department);
      form.set("priority", priority);
      if (relatedOrderId) form.set("relatedOrderId", relatedOrderId);
      for (const f of files) form.append("attachments", f);

      const res = await fetch("/api/support/tickets", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit ticket.");
        setPending(false);
        return;
      }
      const ticket = data.ticket as { id?: string; reference?: string } | undefined;
      if (!ticket?.id || !ticket.reference) {
        setError("Ticket was created but the response was incomplete. Check My Tickets.");
        setPending(false);
        return;
      }
      onCreated({ id: ticket.id, reference: ticket.reference });
    } catch {
      setError("Could not submit ticket.");
      setPending(false);
    }
  }

  return (
    <form className="ds__raise" onSubmit={submit} noValidate>
      <button type="button" className="ds__back-link" onClick={requestCancel}>
        <ArrowLeft size={14} strokeWidth={2.4} />
        Back to Support Centre
      </button>

      {error ? (
        <p className="ds__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="ds__raise-section">
        <div className="ds__section-title">
          <span className="ds__section-accent" aria-hidden />
          <h3>Your details</h3>
        </div>
        <div className="ds__identity">
          <div className="ds__identity-card">
            <User size={16} strokeWidth={2} aria-hidden />
            <div>
              <span>Full name</span>
              <strong>{identity.fullName}</strong>
            </div>
          </div>
          <div className="ds__identity-card">
            <Mail size={16} strokeWidth={2} aria-hidden />
            <div>
              <span>Email address</span>
              <strong>{identity.email}</strong>
            </div>
          </div>
          <div className="ds__identity-card">
            <Building2 size={16} strokeWidth={2} aria-hidden />
            <div>
              <span>Dealership / Company</span>
              <strong>{identity.organizationName}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="ds__raise-section">
        <div className="ds__section-title">
          <span className="ds__section-accent" aria-hidden />
          <h3>Ticket details</h3>
        </div>

        <div className="ds__ticket-row">
          <div className="ds__field">
            <label htmlFor="ds-department">
              Department <span>*</span>
            </label>
            <div className="ds__control">
              <Layers size={16} strokeWidth={2} aria-hidden />
              <select
                id="ds-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value as SupportDepartment | "")}
                required
                aria-invalid={Boolean(fieldErrors.department)}
              >
                <option value="">Select department</option>
                {SUPPORT_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={2.2} aria-hidden />
            </div>
            {fieldErrors.department ? <em className="ds__field-error">{fieldErrors.department}</em> : null}
          </div>

          <div className="ds__field">
            <label id="ds-priority-label">
              Priority <span>*</span>
            </label>
            <div className="ds__priority-pills" role="group" aria-labelledby="ds-priority-label">
              <Flag size={15} strokeWidth={2} aria-hidden className="ds__priority-flag" />
              {SUPPORT_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`ds__prio-pill ds__prio-pill--${p} ${priority === p ? "is-on" : ""}`}
                  aria-pressed={priority === p}
                  onClick={() => setPriority(p)}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ds__field">
          <label htmlFor="ds-subject">
            Subject <span>*</span>
          </label>
          <div className="ds__control">
            <Pencil size={16} strokeWidth={2} aria-hidden />
            <input
              id="ds-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter a brief subject (e.g. Delivery delay, PFI clarification, system access)"
              maxLength={MAX_SUPPORT_SUBJECT}
              required
              aria-invalid={Boolean(fieldErrors.subject)}
            />
          </div>
          {fieldErrors.subject ? <em className="ds__field-error">{fieldErrors.subject}</em> : null}
        </div>

        <div className="ds__field">
          <label htmlFor="ds-description">
            Description <span>*</span>
          </label>
          <div className="ds__textarea-wrap">
            <FileText size={16} strokeWidth={2} className="ds__textarea-ico" aria-hidden />
            <textarea
              id="ds-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_SUPPORT_DESCRIPTION))}
              placeholder="Provide detailed information about your issue or request..."
              maxLength={MAX_SUPPORT_DESCRIPTION}
              required
              aria-invalid={Boolean(fieldErrors.description)}
            />
            <span className="ds__char-count" aria-live="polite">
              {description.length.toLocaleString("en-GB")} / {MAX_SUPPORT_DESCRIPTION.toLocaleString("en-GB")}
            </span>
          </div>
          {fieldErrors.description ? <em className="ds__field-error">{fieldErrors.description}</em> : null}
        </div>
      </section>

      <section className="ds__raise-section">
        <div className="ds__attach-row">
          <div className="ds__field">
            <label htmlFor="ds-related">Related reference (optional)</label>
            <div className="ds__control">
              <Tag size={16} strokeWidth={2} aria-hidden />
              <select
                id="ds-related"
                value={relatedOrderId}
                onChange={(e) => setRelatedOrderId(e.target.value)}
              >
                <option value="">Link to an order or PFI (e.g. DO-2026-000002)</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.reference}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={2.2} aria-hidden />
            </div>
          </div>

          <div className="ds__field">
            <label>
              <span className="ds__attach-label">
                <Paperclip size={14} strokeWidth={2} aria-hidden />
                Attachments
              </span>
              <em className="ds__attach-hint">(Max {MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024)} MB in total)</em>
            </label>
            <div
              className={`ds__dropzone ${dragOver ? "is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
            >
              <CloudUpload size={28} strokeWidth={1.75} aria-hidden />
              <strong>Drag and drop files here</strong>
              <span>or browse to upload (JPG, PNG, PDF, WebP)</span>
              <button type="button" className="ds__browse" onClick={() => inputRef.current?.click()}>
                Browse files
              </button>
              <input
                ref={inputRef}
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            {files.length ? (
              <div className="ds__files">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="ds__file">
                    <Paperclip size={14} />
                    <span>
                      {f.name} · {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f.name}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="ds__raise-foot">
        <button type="button" className="ds__btn-outline" onClick={requestCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="ds__btn-yellow ds__btn-submit" disabled={pending}>
          <Send size={15} strokeWidth={2.2} />
          {pending ? "Submitting…" : "Submit Ticket"}
        </button>
      </footer>
    </form>
  );
}

function faqIcon(id: FaqIconId) {
  if (id === "truck") return <Truck size={15} strokeWidth={2} />;
  if (id === "document") return <FileText size={15} strokeWidth={2} />;
  if (id === "card") return <CreditCard size={15} strokeWidth={2} />;
  if (id === "download") return <Download size={15} strokeWidth={2} />;
  if (id === "alert") return <AlertCircle size={15} strokeWidth={2} />;
  if (id === "people") return <Users size={15} strokeWidth={2} />;
  return <Settings size={15} strokeWidth={2} />;
}

function categoryFilterIcon(key: "ALL" | FaqCategory) {
  if (key === "Orders") return <Ticket size={13} strokeWidth={2} />;
  if (key === "PFIs") return <FileText size={13} strokeWidth={2} />;
  if (key === "Payments") return <CreditCard size={13} strokeWidth={2} />;
  if (key === "Technical") return <Settings size={13} strokeWidth={2} />;
  if (key === "General") return <CircleHelp size={13} strokeWidth={2} />;
  return null;
}

function FaqPanel({ onRaise }: { onRaise: () => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"ALL" | FaqCategory>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => filterFaqs({ category, query: q }), [category, q]);

  useEffect(() => {
    setOpenId(null);
  }, [category, q]);

  return (
    <div className="ds__faq">
      <header className="ds__faq-head">
        <div className="ds__faq-head-left">
          <span className="ds__faq-head-ico" aria-hidden>
            <CircleHelp size={28} strokeWidth={2} />
          </span>
          <div>
            <p className="ds__faq-kicker">Support Centre</p>
            <h2>Frequently Asked Questions</h2>
            <p>
              Find quick answers to common questions. If you still need help, you can raise a ticket
              or contact the Trinity team.
            </p>
          </div>
        </div>
        <label className="ds__faq-search">
          <Search size={15} strokeWidth={1.75} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search FAQs..."
            aria-label="Search FAQs"
          />
        </label>
      </header>

      <div className="ds__faq-cats" role="tablist" aria-label="FAQ categories">
        {FAQ_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={category === c.key}
            className={`ds__faq-cat-pill ${category === c.key ? "is-active" : ""}`}
            onClick={() => setCategory(c.key)}
          >
            {categoryFilterIcon(c.key)}
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="ds__faq-empty">
          <strong>No matching questions found</strong>
          <p>Try another search or raise a support ticket for assistance.</p>
          <button type="button" className="ds__btn-yellow" onClick={onRaise}>
            <TicketPlus size={16} />
            Raise a New Ticket
          </button>
        </div>
      ) : (
        <div className="ds__faq-list">
          {filtered.map((item) => {
            const open = openId === item.id;
            return (
              <div key={item.id} className={`ds__faq-row ${open ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="ds__faq-q"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="ds__faq-q-ico" aria-hidden>
                    {faqIcon(item.icon)}
                  </span>
                  <span className="ds__faq-q-text">{item.question}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2.2}
                    className={`ds__faq-chevron ${open ? "is-open" : ""}`}
                    aria-hidden
                  />
                </button>
                {open ? (
                  <div className="ds__faq-a">
                    <p>{item.answer}</p>
                    {item.id === "place-order" ? (
                      <Link href="/dealer/orders/new">Go to Place an Order →</Link>
                    ) : null}
                    {item.id === "view-pfi" || item.id === "download-docs" ? (
                      <Link href="/dealer/orders?view=documents">Open PFIs →</Link>
                    ) : null}
                    {item.id === "track-delivery" ? (
                      <Link href="/dealer/orders">Open My Orders →</Link>
                    ) : null}
                    {item.id === "order-issue" ? (
                      <button type="button" className="ds__faq-inline" onClick={onRaise}>
                        Raise a New Ticket →
                      </button>
                    ) : null}
                    {item.id === "contact-sales" ? (
                      <Link href="/dealer/messaging">Open Messages →</Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FaqAside({
  onRaise,
  onContact,
}: {
  onRaise: () => void;
  onContact: () => void;
}) {
  const phone = SUPPORT_CONTACT.phones[0] ?? "";
  return (
    <>
      <div className="ds__aside-card ds__aside-card--help">
        <span className="ds__help-ico" aria-hidden>
          <Lightbulb size={18} strokeWidth={2} />
        </span>
        <h3>Still need help?</h3>
        <p>
          Can&apos;t find what you&apos;re looking for? Raise a ticket and our team will get back to
          you as soon as possible.
        </p>
        <button type="button" className="ds__btn-yellow ds__btn-help" onClick={onRaise}>
          <TicketPlus size={16} strokeWidth={2.2} />
          Raise a New Ticket
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>

      <div className="ds__aside-card">
        <div className="ds__quick-head">
          <Link2 size={16} strokeWidth={2} aria-hidden />
          <h3>Quick Links</h3>
        </div>
        <div className="ds__quick-list">
          <Link href="/dealer/orders" className="ds__quick-row">
            <Truck size={15} />
            <span>Order Tracking</span>
            <ChevronRight size={15} />
          </Link>
          <Link href="/dealer/orders?view=documents" className="ds__quick-row">
            <FileText size={15} />
            <span>PFI Portal</span>
            <ChevronRight size={15} />
          </Link>
          <button type="button" className="ds__quick-row" onClick={onContact}>
            <Phone size={15} />
            <span>Contact Trinity</span>
            <ChevronRight size={15} />
          </button>
          <Link href="/dealer/orders?view=documents" className="ds__quick-row">
            <Download size={15} />
            <span>Download Documents</span>
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="ds__aside-card ds__aside-card--speak">
        <div className="ds__speak-head">
          <Headphones size={18} strokeWidth={2} aria-hidden />
          <div>
            <h3>Need to speak to someone?</h3>
            <p>Call us or email us directly.</p>
          </div>
        </div>
        <ul className="ds__speak-list">
          {phone ? (
            <li>
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                <Phone size={15} />
                {phone}
              </a>
            </li>
          ) : null}
          <li>
            <a href={`mailto:${SUPPORT_CONTACT.email}`}>
              <Mail size={15} />
              {SUPPORT_CONTACT.email}
            </a>
          </li>
        </ul>
      </div>
    </>
  );
}

const CONTACT_DEPARTMENTS: {
  key: SupportDepartment;
  title: string;
  text: string;
  icon: ReactNode;
  tone: string;
}[] = [
  {
    key: "IT",
    title: "IT Support",
    text: "System access, login, portal issues and technical support.",
    icon: <Monitor size={18} strokeWidth={2} />,
    tone: "it",
  },
  {
    key: "FINANCE",
    title: "Finance",
    text: "Payments, PFIs, invoices and account statements.",
    icon: <Coins size={18} strokeWidth={2} />,
    tone: "finance",
  },
  {
    key: "SALES",
    title: "Sales",
    text: "Orders, pricing, product information and account enquiries.",
    icon: <Handshake size={18} strokeWidth={2} />,
    tone: "sales",
  },
  {
    key: "SUPPLY",
    title: "Supply",
    text: "Deliveries, supply availability and logistics.",
    icon: <Truck size={18} strokeWidth={2} />,
    tone: "supply",
  },
];

function telHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function ContactPanel({
  onRaise,
  onRaiseDepartment,
}: {
  onRaise: () => void;
  onRaiseDepartment: (dept: SupportDepartment) => void;
}) {
  const primaryPhone = SUPPORT_CONTACT.phones[0] ?? "";
  const mailto = `mailto:${SUPPORT_CONTACT.email}?subject=${encodeURIComponent(SUPPORT_CONTACT.emailSubject)}`;

  return (
    <div className="ds__contact">
      <h3 className="ds__contact-section-title">Choose how you&apos;d like to reach us</h3>
      <div className="ds__reach-grid">
        <article className="ds__reach-card ds__reach-card--primary">
          <span className="ds__reach-ico" aria-hidden>
            <Ticket size={22} strokeWidth={2} />
          </span>
          <h4>Raise a Ticket</h4>
          <p>Log a request, attach details and track progress.</p>
          <button type="button" className="ds__reach-btn ds__reach-btn--yellow" onClick={onRaise}>
            Create Ticket
            <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
          </button>
        </article>

        <article className="ds__reach-card">
          <span className="ds__reach-ico" aria-hidden>
            <MessageCircle size={22} strokeWidth={2} />
          </span>
          <h4>Send a Message</h4>
          <p>Have a quick question? Chat with our team in real time.</p>
          <Link href="/dealer/messaging" className="ds__reach-btn ds__reach-btn--outline">
            Open Messages
          </Link>
        </article>

        <article className="ds__reach-card">
          <span className="ds__reach-ico" aria-hidden>
            <Phone size={22} strokeWidth={2} />
          </span>
          <h4>Call Us</h4>
          <p>Speak directly with a Trinity representative for immediate support.</p>
          {primaryPhone ? (
            <a href={telHref(primaryPhone)} className="ds__reach-btn ds__reach-btn--outline">
              Call Now
            </a>
          ) : (
            <span className="ds__reach-btn ds__reach-btn--outline is-disabled">Call Now</span>
          )}
        </article>

        <article className="ds__reach-card">
          <span className="ds__reach-ico" aria-hidden>
            <Mail size={22} strokeWidth={2} />
          </span>
          <h4>Email Us</h4>
          <p>Send us your enquiry and we&apos;ll get back to you promptly.</p>
          <a href={mailto} className="ds__reach-btn ds__reach-btn--outline">
            Send Email
          </a>
        </article>
      </div>

      <h3 className="ds__contact-section-title">Contact by Department</h3>
      <div className="ds__dept-grid">
        {CONTACT_DEPARTMENTS.map((d) => (
          <button
            key={d.key}
            type="button"
            className="ds__dept-card"
            onClick={() => onRaiseDepartment(d.key)}
          >
            <span className={`ds__dept-card-ico ds__dept-card-ico--${d.tone}`} aria-hidden>
              {d.icon}
            </span>
            <span className="ds__dept-card-copy">
              <strong>{d.title}</strong>
              <span>{d.text}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactAside() {
  const phones = SUPPORT_CONTACT.phones;
  const primary = phones[0] ?? "";
  return (
    <>
      <div className="ds__aside-card ds__aside-card--info">
        <h3>Trinity Contact Information</h3>
        <ul className="ds__info-list">
          <li>
            <span className="ds__info-ico" aria-hidden>
              <Mail size={15} strokeWidth={2} />
            </span>
            <a href={`mailto:${SUPPORT_CONTACT.email}`}>{SUPPORT_CONTACT.email}</a>
          </li>
          {phones.map((phone) => (
            <li key={phone}>
              <span className="ds__info-ico" aria-hidden>
                <Phone size={15} strokeWidth={2} />
              </span>
              <a href={telHref(phone)}>{phone}</a>
            </li>
          ))}
          <li>
            <span className="ds__info-ico" aria-hidden>
              <MapPin size={15} strokeWidth={2} />
            </span>
            <span>
              <strong>{SUPPORT_CONTACT.location.label}</strong>
              <em>{SUPPORT_CONTACT.location.locality}</em>
            </span>
          </li>
        </ul>
      </div>

      <div className="ds__aside-card ds__aside-card--hours">
        <div className="ds__hours-head">
          <h3>Support Hours</h3>
          <CalendarDays size={16} strokeWidth={2} aria-hidden />
        </div>
        <ul className="ds__hours-list">
          {SUPPORT_CONTACT.hours.map((row) => (
            <li key={row.days}>
              <span>{row.days}</span>
              <strong>{row.hours}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="ds__aside-card ds__aside-card--urgent">
        <div className="ds__urgent-head">
          <Headphones size={18} strokeWidth={2} aria-hidden />
          <h3>Urgent / Critical Support</h3>
        </div>
        <p>For service outages or urgent operational issues, call our priority line.</p>
        {primary ? (
          <a href={telHref(primary)} className="ds__btn-urgent">
            <Phone size={15} strokeWidth={2.2} aria-hidden />
            {primary}
          </a>
        ) : null}
      </div>
    </>
  );
}
