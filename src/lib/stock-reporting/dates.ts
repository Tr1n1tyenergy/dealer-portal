import { nairobiParts } from "@/lib/time/nairobi";

/** UTC midnight for the Africa/Nairobi calendar Y-M-D of `at` (Prisma `@db.Date`). */
export function nairobiBusinessDate(at: Date = new Date()): Date {
  const { year, month, day } = nairobiParts(at);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Display like the mockup: `06 Nov 2026`. */
export function formatStockReportDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(d).padStart(2, "0")} ${months[m]} ${y}`;
}
