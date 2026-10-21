/** Kenya is UTC+3 all year; the servers run on UTC, so dates people see are worked out here. */
const OFFSET_MS = 3 * 60 * 60 * 1000;

/** Year, month (1–12), day and hour of an instant, as a clock in Nairobi shows it. */
export function nairobiParts(at: Date = new Date()) {
  const local = new Date(at.getTime() + OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
  };
}

/** 00:00 Nairobi on the 1st of this month (plus `monthsAhead`, which may be negative), as an instant. */
export function nairobiMonthStart(at: Date = new Date(), monthsAhead = 0): Date {
  const { year, month } = nairobiParts(at);
  return new Date(Date.UTC(year, month - 1 + monthsAhead, 1) - OFFSET_MS);
}
