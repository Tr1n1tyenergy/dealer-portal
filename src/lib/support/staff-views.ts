/** Pure helpers for the staff Support workspace URL state. No Prisma client here. */
import { reportingPeriod } from "@/lib/orders/staff-views";
import { SUPPORT_DEPARTMENTS, SUPPORT_PRIORITIES, SUPPORT_STATUSES, type SupportDepartment, type SupportPriority, type SupportStatus } from "./constants";

export type TicketTab = "conversation" | "details" | "attachments" | "history";
export const TICKET_TABS: TicketTab[] = ["conversation", "details", "attachments", "history"];
export const TICKET_ROW_SIZES = [8, 16, 25, 50] as const;

export type StaffTicketFilters = {
  status: SupportStatus | "ALL";
  department: SupportDepartment | "ALL";
  dealerId: string | null;
  priority: SupportPriority | null;
  period: string;
  from: string | null;
  to: string | null;
  range: { gte: Date; lt: Date } | null;
  q: string;
  page: number;
  rows: number;
  sel: string | null;
  tab: TicketTab;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const id = (value: string) => (/^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : null);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function staffTicketFilters(params: Params, now: Date = new Date()): StaffTicketFilters {
  const status = (SUPPORT_STATUSES as readonly string[]).includes(first(params.status))
    ? (first(params.status) as SupportStatus)
    : "ALL";
  const department = (SUPPORT_DEPARTMENTS as readonly string[]).includes(first(params.dept))
    ? (first(params.dept) as SupportDepartment)
    : "ALL";
  const priority = (SUPPORT_PRIORITIES as readonly string[]).includes(first(params.priority))
    ? (first(params.priority) as SupportPriority)
    : null;
  const rawPeriod = first(params.period);
  // "30d" is support's extra preset: the last 30 Nairobi days including today.
  const period = ["today", "7d", "30d", "month", "custom"].includes(rawPeriod) ? rawPeriod : "all";
  const from = ISO_DAY.test(first(params.from)) ? first(params.from) : null;
  const to = ISO_DAY.test(first(params.to)) ? first(params.to) : null;
  let range = reportingPeriod(period, from, to, now);
  if (period === "30d") {
    const day = reportingPeriod("today", null, null, now)!;
    range = { gte: new Date(day.lt.getTime() - 30 * 24 * 60 * 60 * 1000), lt: day.lt };
  }
  const rowsRaw = Number(first(params.rows));
  const rows = (TICKET_ROW_SIZES as readonly number[]).includes(rowsRaw) ? rowsRaw : 8;
  const tab = (TICKET_TABS as readonly string[]).includes(first(params.tab)) ? (first(params.tab) as TicketTab) : "conversation";
  return {
    status,
    department,
    dealerId: id(first(params.dealer)),
    priority,
    period,
    from,
    to,
    range,
    q: first(params.q).trim().slice(0, 100),
    page: Math.max(1, Math.floor(Number(first(params.page))) || 1),
    rows,
    sel: id(first(params.t)),
    tab,
  };
}
