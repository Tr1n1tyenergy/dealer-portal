import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  CircleX,
  Clock,
  FileText,
  Filter,
  FolderOpen,
  LifeBuoy,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Ticket,
} from "lucide-react";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/session";
import { supportStaffAction } from "@/lib/support/staff-actions";
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_DEPARTMENTS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from "@/lib/support/constants";
import { listTicketsForStaff, staffTicketCounts, staffTicketWhere } from "@/lib/support/service";
import { staffTicketFilters, TICKET_ROW_SIZES, TICKET_TABS, type StaffTicketFilters } from "@/lib/support/staff-views";
import "@/app/intelligence/retail/staff-orders.css";
import "@/app/intelligence/retail/staff-support.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_ICONS = {
  OPEN: FolderOpen,
  IN_PROGRESS: RefreshCw,
  AWAITING_RESPONSE: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: CircleX,
} as const;

function query(filters: StaffTicketFilters, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams();
  const base: Record<string, string | null> = {
    status: filters.status === "ALL" ? null : filters.status,
    dept: filters.department === "ALL" ? null : filters.department,
    dealer: filters.dealerId,
    priority: filters.priority,
    period: filters.period === "all" ? null : filters.period,
    from: filters.from,
    to: filters.to,
    q: filters.q || null,
    page: filters.page > 1 ? String(filters.page) : null,
    rows: filters.rows !== 8 ? String(filters.rows) : null,
    t: filters.sel,
    tab: filters.tab === "conversation" ? null : filters.tab,
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) if (value) params.set(key, value);
  const text = params.toString();
  return `/intelligence/retail/support${text ? `?${text}` : ""}`;
}

const when = (at: Date, withYear = false) =>
  at.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });

const personName = (user: { firstName: string | null; lastName: string | null } | null | undefined) =>
  user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || "Staff" : "—";

export default async function StaffSupportPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireInternal();
  if (!canUser(session.user, "support", "view")) redirect("/intelligence/retail");
  const mayAct = canUser(session.user, "support", "act");

  const params = await searchParams;
  const filters = staffTicketFilters(params);
  const creating = params.new === "1" && mayAct;

  const scope = {
    department: filters.department,
    dealerOrganizationId: filters.dealerId,
    priority: filters.priority,
    createdRange: filters.range,
    q: filters.q,
  };
  const countsWhere = staffTicketWhere(scope);
  const [counts, tickets, totalFiltered, dealers, staff] = await Promise.all([
    staffTicketCounts(countsWhere),
    listTicketsForStaff({
      ...scope,
      status: filters.status,
      skip: (filters.page - 1) * filters.rows,
      take: filters.rows,
    }),
    prisma.supportTicket.count({ where: staffTicketWhere({ ...scope, status: filters.status }) }),
    prisma.dealerOrganization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    mayAct
      ? prisma.user.findMany({
          where: { accountType: "INTERNAL", status: "ACTIVE" },
          orderBy: { firstName: "asc" },
          select: { id: true, firstName: true, lastName: true, department: true },
        })
      : Promise.resolve([]),
  ]);

  const selectedId = filters.sel && tickets.some((t) => t.id === filters.sel) ? filters.sel : tickets[0]?.id ?? null;
  const ticket = selectedId
    ? await prisma.supportTicket.findUnique({
        where: { id: selectedId },
        include: {
          dealerOrganization: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true, email: true, accountType: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          relatedOrder: { select: { id: true, reference: true } },
          messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { firstName: true, lastName: true, accountType: true } }, attachments: true } },
          attachments: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { firstName: true, lastName: true } } } },
          events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { firstName: true, lastName: true } } } },
        },
      })
    : null;

  const pages = Math.max(1, Math.ceil(totalFiltered / filters.rows));
  const page = Math.min(filters.page, pages);
  const navItems: { key: StaffTicketFilters["status"]; label: string; count: number }[] = [
    { key: "ALL", label: "All Tickets", count: counts.total },
    ...SUPPORT_STATUSES.map((status) => ({ key: status, label: STATUS_LABELS[status], count: counts.byStatus[status] })),
  ];
  const eventLabel = (event: (typeof ticket extends null ? never : NonNullable<typeof ticket>)["events"][number]) => {
    switch (event.type) {
      case "CREATED":
        return "Ticket created";
      case "STATUS_CHANGED":
        return `Status changed${event.fromValue ? ` from ${STATUS_LABELS[event.fromValue as keyof typeof STATUS_LABELS] ?? event.fromValue}` : ""} to ${STATUS_LABELS[event.toValue as keyof typeof STATUS_LABELS] ?? event.toValue}`;
      case "ASSIGNED":
        return event.toValue ? "Ticket assigned" : "Assignment removed";
      case "PRIORITY_CHANGED":
        return `Priority changed from ${PRIORITY_LABELS[event.fromValue as keyof typeof PRIORITY_LABELS] ?? event.fromValue} to ${PRIORITY_LABELS[event.toValue as keyof typeof PRIORITY_LABELS] ?? event.toValue}`;
      case "DEPARTMENT_CHANGED":
        return `Moved from ${DEPARTMENT_LABELS[event.fromValue as keyof typeof DEPARTMENT_LABELS] ?? event.fromValue} to ${DEPARTMENT_LABELS[event.toValue as keyof typeof DEPARTMENT_LABELS] ?? event.toValue}`;
      case "MESSAGE_ADDED":
        return event.note === "Internal note" ? "Internal note added" : "Reply sent";
      case "ATTACHMENT_ADDED":
        return `Attachment added: ${event.toValue ?? ""}`;
      case "RESOLVED":
        return "Ticket resolved";
      case "CLOSED":
        return "Ticket closed";
      case "REOPENED":
        return "Ticket reopened";
      default:
        return event.type;
    }
  };

  return (
    <div className="so sup">
      <header className="so-hero">
        <div className="so-hero__text">
          <div className="so-hero__eyebrow">Support Centre</div>
          <h1>Dealer Support Tickets</h1>
          <p>Receive, manage and resolve all dealer support requests.</p>
        </div>
      </header>

      <div className="so-wrap">
        <section className="sup-kpis" aria-label="Ticket totals">
          <Link href={query(filters, { status: null, page: null, t: null })} className={`so-kpi${filters.status === "ALL" ? " is-active" : ""}`}>
            <span className="so-ico"><Ticket size={16} /></span>
            <span className="so-kpi__value">{counts.total}</span>
            <span className="so-kpi__label">Total Tickets</span>
          </Link>
          {SUPPORT_STATUSES.filter((s) => s !== "CLOSED").map((status) => {
            const Icon = STATUS_ICONS[status];
            return (
              <Link key={status} href={query(filters, { status, page: null, t: null })} className={`so-kpi${filters.status === status ? " is-active" : ""}`}>
                <span className="so-ico"><Icon size={16} /></span>
                <span className="so-kpi__value">{counts.byStatus[status]}</span>
                <span className="so-kpi__label">{STATUS_LABELS[status]}</span>
              </Link>
            );
          })}
          {mayAct ? (
            <Link href={query(filters, { new: "1" })} className="so-kpi sup-kpi-create">
              <Plus size={17} /> Create Internal Ticket
            </Link>
          ) : (
            <Link href={query(filters, { status: "CLOSED", page: null, t: null })} className={`so-kpi${filters.status === "CLOSED" ? " is-active" : ""}`}>
              <span className="so-ico"><CircleX size={16} /></span>
              <span className="so-kpi__value">{counts.byStatus.CLOSED}</span>
              <span className="so-kpi__label">Closed</span>
            </Link>
          )}
        </section>

        <div className="sup-cols">
          <aside className="so-card">
            <nav className="sup-nav" aria-label="Ticket statuses">
              {navItems.map((item) => {
                const Icon = item.key === "ALL" ? Ticket : STATUS_ICONS[item.key as keyof typeof STATUS_ICONS];
                return (
                  <Link
                    key={item.key}
                    href={query(filters, { status: item.key === "ALL" ? null : item.key, page: null, t: null })}
                    className={`sup-nav__item${filters.status === item.key ? " is-active" : ""}`}
                  >
                    <Icon size={15} /> {item.label}
                    <span className="sup-nav__count">{item.count}</span>
                  </Link>
                );
              })}
            </nav>
            <form className="sup-filters" action="/intelligence/retail/support" method="get">
              {filters.status !== "ALL" ? <input type="hidden" name="status" value={filters.status} /> : null}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 750, fontSize: "0.9rem" }}>
                <Filter size={15} /> Filters
              </div>
              <label className="so-field">
                <span>Department</span>
                <select name="dept" defaultValue={filters.department}>
                  <option value="ALL">All Departments</option>
                  {SUPPORT_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                  ))}
                </select>
              </label>
              <label className="so-field">
                <span>Dealer / Organisation</span>
                <select name="dealer" defaultValue={filters.dealerId ?? ""}>
                  <option value="">All Dealers</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="so-field">
                <span>Priority</span>
                <select name="priority" defaultValue={filters.priority ?? ""}>
                  <option value="">All Priorities</option>
                  {SUPPORT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </label>
              <label className="so-field">
                <span>Date range</span>
                <select name="period" defaultValue={filters.period}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="month">This month</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>
              {filters.period === "custom" ? (
                <>
                  <label className="so-field"><span>From</span><input type="date" name="from" defaultValue={filters.from ?? ""} /></label>
                  <label className="so-field"><span>To</span><input type="date" name="to" defaultValue={filters.to ?? ""} /></label>
                </>
              ) : null}
              <button type="submit" className="so-btn so-btn--gold">Apply</button>
              <Link href="/intelligence/retail/support" className="so-btn so-btn--line" style={{ justifyContent: "center" }}>Clear filters</Link>
            </form>
          </aside>

          <section className="so-card">
            <div className="sup-table-head">
              <div>
                <h2>Tickets ({totalFiltered})</h2>
                <p>All dealer support requests across stations and operations.</p>
              </div>
              <form className="sup-search" action="/intelligence/retail/support" method="get">
                {filters.status !== "ALL" ? <input type="hidden" name="status" value={filters.status} /> : null}
                {filters.department !== "ALL" ? <input type="hidden" name="dept" value={filters.department} /> : null}
                {filters.dealerId ? <input type="hidden" name="dealer" value={filters.dealerId} /> : null}
                {filters.priority ? <input type="hidden" name="priority" value={filters.priority} /> : null}
                <input name="q" defaultValue={filters.q} maxLength={100} placeholder="Search by ticket no., subject, dealer..." aria-label="Search tickets" />
                <button type="submit" className="so-btn so-btn--line">Search</button>
              </form>
            </div>
            <div className="so-table-wrap">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Ticket No.</th>
                    <th>Subject</th>
                    <th>Dealer / Station</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((row) => (
                    <tr key={row.id} className={row.id === selectedId ? "is-selected" : undefined}>
                      <td><Link className="so-ref" href={`${query(filters, { t: row.id, tab: null })}#ticket`}>{row.reference}</Link></td>
                      <td style={{ maxWidth: 220 }}>{row.subject}</td>
                      <td>
                        {row.dealerOrganization?.name ?? "Internal"}
                        {row.origin === "INTERNAL" ? <div className="so-cell-sub">Internal ticket</div> : null}
                      </td>
                      <td>{DEPARTMENT_LABELS[row.department]}</td>
                      <td><span className={`so-pill sup-pill--prio-${row.priority}`}>{PRIORITY_LABELS[row.priority]}</span></td>
                      <td><span className={`so-pill sup-pill--st-${row.status}`}>{STATUS_LABELS[row.status]}</span></td>
                      <td className="so-updated">{when(row.updatedAt)}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 ? (
                    <tr><td className="so-empty" colSpan={7}>{filters.q ? `No tickets match "${filters.q}".` : "No tickets match these filters."}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="so-pager">
              <span className="so-pager__info">
                Showing {totalFiltered === 0 ? 0 : (page - 1) * filters.rows + 1}–{Math.min(page * filters.rows, totalFiltered)} of {totalFiltered} tickets
              </span>
              <form action="/intelligence/retail/support" method="get" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {Object.entries({ status: filters.status === "ALL" ? "" : filters.status, dept: filters.department === "ALL" ? "" : filters.department, dealer: filters.dealerId ?? "", priority: filters.priority ?? "", q: filters.q }).map(([k, v]) =>
                  v ? <input key={k} type="hidden" name={k} value={v} /> : null
                )}
                <label className="so-pager__info" style={{ margin: 0 }}>
                  Rows per page:{" "}
                  <select name="rows" defaultValue={String(filters.rows)}>
                    {TICKET_ROW_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <button type="submit" className="so-page">Go</button>
              </form>
              <Link href={query(filters, { page: page > 1 ? String(page - 1) : null })} className={`so-page${page <= 1 ? " is-disabled" : ""}`} aria-label="Previous page">‹</Link>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                .map((n, i, list) => (
                  <span key={n} style={{ display: "inline-flex", gap: 8 }}>
                    {i > 0 && list[i - 1] !== n - 1 ? <span className="so-page is-disabled">…</span> : null}
                    <Link href={query(filters, { page: n > 1 ? String(n) : null })} className="so-page" aria-current={n === page ? "page" : undefined}>{n}</Link>
                  </span>
                ))}
              <Link href={query(filters, { page: page < pages ? String(page + 1) : null })} className={`so-page${page >= pages ? " is-disabled" : ""}`} aria-label="Next page">›</Link>
            </div>
          </section>

          <aside id="ticket" className="so-card sup-ticket" aria-label="Selected ticket">
            {!ticket ? (
              <div className="sup-empty">
                <span className="so-ico" style={{ width: 54, height: 54 }}><LifeBuoy size={26} /></span>
                <strong style={{ color: "var(--so-navy)" }}>No ticket selected</strong>
                <span>Select a ticket from the table to review its conversation, details and history.</span>
              </div>
            ) : (
              <>
                <div className="sup-ticket__head">
                  <span className="so-ico"><Ticket size={15} /></span>
                  <div>
                    <div className="sup-ticket__ref">{ticket.reference}</div>
                    <div className="sup-ticket__subject">{ticket.subject}</div>
                    <div className="sup-ticket__meta">
                      <span>{ticket.dealerOrganization?.name ?? `Internal · raised by ${personName(ticket.createdBy)}`}</span>
                      <span>{when(ticket.createdAt, true)}</span>
                    </div>
                  </div>
                  <span className={`so-pill sup-pill--st-${ticket.status} sup-ticket__status`}>{STATUS_LABELS[ticket.status]}</span>
                </div>

                <nav className="sup-tabs" aria-label="Ticket sections">
                  {TICKET_TABS.map((tab) => (
                    <Link key={tab} href={query(filters, { t: ticket.id, tab: tab === "conversation" ? null : tab })} className="sup-tab" aria-current={filters.tab === tab ? "page" : undefined}>
                      {tab === "conversation" ? "Conversation" : tab === "details" ? "Details" : tab === "attachments" ? `Attachments (${ticket.attachments.length})` : "History"}
                    </Link>
                  ))}
                </nav>

                {filters.tab === "conversation" ? (
                  <div className="sup-pane">
                    <div className="sup-msg">
                      <div className="sup-msg__who">{personName(ticket.createdBy)} ({ticket.origin === "INTERNAL" ? "Staff" : "Dealer"}) <span className="sup-msg__when">{when(ticket.createdAt)}</span></div>
                      <div className="sup-msg__body">{ticket.description}</div>
                    </div>
                    {ticket.messages.map((msg) => {
                      const staffMsg = msg.author.accountType === "INTERNAL";
                      return (
                        <div key={msg.id} className={`sup-msg${staffMsg ? " sup-msg--staff" : ""}${msg.visibility === "INTERNAL_NOTE" ? " sup-msg--internal" : ""}`}>
                          <div className="sup-msg__who">
                            {personName(msg.author)} ({staffMsg ? "Staff" : "Dealer"}){msg.visibility === "INTERNAL_NOTE" ? " · internal note" : ""}
                            <span className="sup-msg__when">{when(msg.createdAt)}</span>
                          </div>
                          <div className="sup-msg__body">{msg.body}</div>
                          {msg.attachments.length > 0 ? (
                            <div className="sup-msg__files">
                              {msg.attachments.map((att) => (
                                <a key={att.id} className="so-btn so-btn--line" style={{ padding: "4px 10px", fontSize: "0.75rem" }} href={`/api/support/tickets/${ticket.id}/attachments/${att.id}`}>
                                  <Paperclip size={12} /> {att.fileName}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {ticket.messages.length === 0 ? <p className="so-preview__hint">No replies yet.</p> : null}
                  </div>
                ) : null}

                {filters.tab === "details" ? (
                  <div className="sup-pane">
                    <dl className="sup-kv">
                      <h3>Ticket</h3>
                      <div><dt>Reference</dt><dd>{ticket.reference}</dd></div>
                      <div><dt>Origin</dt><dd>{ticket.origin === "INTERNAL" ? "Internal (staff)" : "Dealer"}</dd></div>
                      <div><dt>Department</dt><dd>{DEPARTMENT_LABELS[ticket.department]}</dd></div>
                      <div><dt>Priority</dt><dd>{PRIORITY_LABELS[ticket.priority]}</dd></div>
                      <div><dt>Created</dt><dd>{when(ticket.createdAt, true)}</dd></div>
                      <div><dt>Last updated</dt><dd>{when(ticket.updatedAt, true)}</dd></div>
                      {ticket.relatedOrder ? (
                        <div><dt>Related order</dt><dd><Link className="so-ref" href={`/intelligence/retail/orders/${ticket.relatedOrder.id}`}>{ticket.relatedOrder.reference}</Link></dd></div>
                      ) : null}
                      <h3>Contact</h3>
                      <div><dt>{ticket.origin === "INTERNAL" ? "Raised by" : "Dealer"}</dt><dd>{ticket.dealerOrganization?.name ?? personName(ticket.createdBy)}</dd></div>
                      <div><dt>Contact</dt><dd>{personName(ticket.createdBy)}</dd></div>
                      <div><dt>Email</dt><dd>{ticket.createdBy.email}</dd></div>
                      <h3>Assignment</h3>
                      <div><dt>Assigned to</dt><dd>{ticket.assignee ? personName(ticket.assignee) : "Unassigned"}</dd></div>
                      <h3>Resolution</h3>
                      <div><dt>Summary</dt><dd>{ticket.resolutionSummary ?? "—"}</dd></div>
                      <div><dt>Resolved at</dt><dd>{ticket.resolvedAt ? when(ticket.resolvedAt, true) : "—"}</dd></div>
                      <div><dt>Closed at</dt><dd>{ticket.closedAt ? when(ticket.closedAt, true) : "—"}</dd></div>
                    </dl>
                    <div>
                      <h3 style={{ margin: "4px 0", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--so-blue)" }}>Original description</h3>
                      <div className="sup-msg__body">{ticket.description}</div>
                    </div>
                  </div>
                ) : null}

                {filters.tab === "attachments" ? (
                  <div className="sup-pane">
                    {ticket.attachments.map((att) => (
                      <div key={att.id} className="sod-doc">
                        <span className="so-ico"><FileText size={14} /></span>
                        <div>
                          <div className="sod-doc__name">{att.fileName}</div>
                          <div className="sod-doc__sub">{att.mimeType} · {(att.sizeBytes / 1024).toFixed(0)} KB · {personName(att.uploadedBy)} · {when(att.createdAt)}</div>
                        </div>
                        <a className="sod-doc__act" href={`/api/support/tickets/${ticket.id}/attachments/${att.id}`}>Download</a>
                      </div>
                    ))}
                    {ticket.attachments.length === 0 ? <p className="so-preview__hint">No attachments on this ticket.</p> : null}
                  </div>
                ) : null}

                {filters.tab === "history" ? (
                  <div className="sup-pane">
                    {ticket.events.map((event) => (
                      <div className="sod-event" key={event.id}>
                        <span className={`sod-event__dot${event.actorId ? "" : " sod-event__dot--note"}`} />
                        <div>
                          <div className="sod-event__title">{eventLabel(event)}</div>
                          <div className="sod-event__meta">By {event.actor ? personName(event.actor) : "System"} · {when(event.createdAt, true)}</div>
                        </div>
                      </div>
                    ))}
                    {ticket.events.length === 0 ? <p className="so-preview__hint">No events recorded.</p> : null}
                  </div>
                ) : null}

                {mayAct && filters.tab === "conversation" && ticket.status !== "CLOSED" ? (
                  <form className="sup-compose" action={supportStaffAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <textarea name="body" maxLength={4000} required placeholder="Type your response..." aria-label="Reply" />
                    <div className="sup-compose__row">
                      <label><input type="checkbox" name="internal" /> Internal note</label>
                      <label><input type="checkbox" name="awaiting" /> Needs dealer response</label>
                      <button className="so-btn so-btn--gold" name="action" value="reply"><MessageCircle size={14} /> Send Reply</button>
                    </div>
                  </form>
                ) : null}

                {mayAct ? (
                  <>
                    <form className="sup-assign" action={supportStaffAction}>
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <div className="sup-assign__grid">
                        <label>
                          Assign to
                          <select name="assigneeId" defaultValue={ticket.assignee?.id ?? ""}>
                            <option value="">Unassigned</option>
                            {staff.map((member) => (
                              <option key={member.id} value={member.id}>
                                {personName(member)}{member.department ? ` · ${member.department}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Priority
                          <select name="priority" defaultValue={ticket.priority}>
                            {SUPPORT_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                          </select>
                        </label>
                        <label>
                          Department
                          <select name="department" defaultValue={ticket.department}>
                            {SUPPORT_DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>)}
                          </select>
                        </label>
                        <button className="so-btn so-btn--gold" name="action" value="assign" style={{ alignSelf: "end" }}>Update Ticket</button>
                      </div>
                    </form>
                    <form className="sup-assign" action={supportStaffAction}>
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <div className="sup-assign__grid">
                        {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" ? (
                          <>
                            <label style={{ gridColumn: "1 / -1" }}>
                              Resolution summary (required to resolve)
                              <input type="text" name="resolutionSummary" maxLength={2000} placeholder="What fixed it?" />
                            </label>
                            <input type="hidden" name="status" value="RESOLVED" />
                            <button className="so-btn so-btn--blue" name="action" value="status"><CheckCircle2 size={14} /> Mark Resolved</button>
                          </>
                        ) : null}
                        {ticket.status === "RESOLVED" ? (
                          <>
                            <input type="hidden" name="status" value="CLOSED" />
                            <button className="so-btn so-btn--blue" name="action" value="status">Close Ticket</button>
                          </>
                        ) : null}
                      </div>
                    </form>
                    {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") ? (
                      <form className="sup-assign" action={supportStaffAction}>
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <input type="hidden" name="status" value="IN_PROGRESS" />
                        <button className="so-btn so-btn--line" name="action" value="status">Reopen Ticket</button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </div>

      {creating ? (
        <div className="sup-modal">
          <div className="sup-modal__card">
            <h2>Create Internal Ticket</h2>
            <p className="so-cell-sub">Internal tickets are never shown to dealers.</p>
            <form action={supportStaffAction}>
              <label>Subject<input name="subject" required minLength={4} maxLength={160} /></label>
              <div className="sup-modal__row">
                <label>Department
                  <select name="department" defaultValue="OPERATIONS">
                    {SUPPORT_DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>)}
                  </select>
                </label>
                <label>Priority
                  <select name="priority" defaultValue="MEDIUM">
                    {SUPPORT_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </label>
              </div>
              <label>Description<textarea name="description" required minLength={10} maxLength={2000} rows={4} /></label>
              <div className="sup-modal__row">
                <label>Related dealer (optional)
                  <select name="dealerOrganizationId" defaultValue="">
                    <option value="">None</option>
                    {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label>Assign to (optional)
                  <select name="assigneeId" defaultValue="">
                    <option value="">Unassigned</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{personName(member)}</option>)}
                  </select>
                </label>
              </div>
              <div className="sup-modal__actions">
                <Link href={query(filters, { new: null })} className="so-btn so-btn--line">Cancel</Link>
                <button className="so-btn so-btn--gold" name="action" value="create-internal">Create Ticket</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
