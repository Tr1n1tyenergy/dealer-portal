import type {
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";

export const SUPPORT_DEPARTMENTS = ["IT", "FINANCE", "SALES", "SUPPLY"] as const;
export type SupportDepartment = (typeof SUPPORT_DEPARTMENTS)[number];

export const SUPPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "AWAITING_RESPONSE", "CLOSED"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const DEPARTMENT_LABELS: Record<SupportTicketDepartment, string> = {
  IT: "IT",
  FINANCE: "Finance",
  SALES: "Sales",
  SUPPLY: "Supply",
};

export const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  AWAITING_RESPONSE: "Awaiting Response",
  CLOSED: "Closed",
};

export const STATUS_GUIDE: { status: SupportTicketStatus; description: string }[] = [
  { status: "OPEN", description: "Ticket received and awaiting review." },
  { status: "IN_PROGRESS", description: "Our team is working on it." },
  { status: "AWAITING_RESPONSE", description: "We need more information from you." },
  { status: "CLOSED", description: "The issue has been resolved." },
];

export const MAX_SUPPORT_ATTACHMENTS = 5;
/** Vercel refuses request bodies over 4.5 MB, so all files in one send must stay under it. */
export const MAX_SUPPORT_UPLOAD_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_SUPPORT_ATTACHMENT_BYTES = MAX_SUPPORT_UPLOAD_TOTAL_BYTES;
export const MAX_SUPPORT_SUBJECT = 160;
export const MAX_SUPPORT_DESCRIPTION = 2000;
export const MAX_SUPPORT_MESSAGE = 4000;

export const ALLOWED_SUPPORT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Why these files cannot be sent together, or null when they can. */
export function supportUploadProblem(sizes: number[]): string | null {
  if (sizes.length > MAX_SUPPORT_ATTACHMENTS) return `You can attach up to ${MAX_SUPPORT_ATTACHMENTS} files.`;
  const total = sizes.reduce((sum, n) => sum + n, 0);
  if (total > MAX_SUPPORT_UPLOAD_TOTAL_BYTES) {
    return `Attachments can be up to ${MAX_SUPPORT_UPLOAD_TOTAL_BYTES / (1024 * 1024)} MB in total. Remove a file or send it in a reply.`;
  }
  return null;
}
