"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SupportTicketStatus } from "@prisma/client";
import { SUPPORT_STATUSES, STATUS_LABELS } from "@/lib/support/constants";
import { supportStaffAction } from "@/lib/support/staff-actions";

const DISPLAY: Record<SupportTicketStatus, string> = {
  ...STATUS_LABELS,
  OPEN: "Opened",
};

/** Compact status control — persists via existing staff action on change. */
export function StaffSupportStatusSelect({
  ticketId,
  status,
  disabled,
}: {
  ticketId: string;
  status: SupportTicketStatus;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="sup-status-form"
      onChange={(e) => {
        const form = e.currentTarget;
        startTransition(async () => {
          await supportStaffAction(new FormData(form));
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="action" value="status" />
      <label className="sup-status-select">
        <span className="sr-only">Status</span>
        <select name="status" defaultValue={status} disabled={disabled || pending} aria-label="Ticket status">
          {SUPPORT_STATUSES.filter((s) => s !== "RESOLVED" || status === "RESOLVED").map((s) => (
            <option key={s} value={s}>
              {DISPLAY[s]}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
