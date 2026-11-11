"use server";

import { revalidatePath } from "next/cache";
import type { SupportTicketDepartment, SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import {
  createTicket,
  staffAddMessage,
  staffAssignTicket,
  staffUpdateTicketStatus,
} from "@/lib/support/service";
import { SUPPORT_DEPARTMENTS, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from "@/lib/support/constants";

const text = (value: FormDataEntryValue | null, max: number) => String(value ?? "").trim().slice(0, max);

/** Staff actions on support tickets; refused silently for roles without support.act (buttons are hidden too). */
export async function supportStaffAction(formData: FormData) {
  const session = await requireInternal();
  const action = text(formData.get("action"), 40);
  const ticketId = text(formData.get("ticketId"), 40);
  if (!canUser(session.user, "support", "act")) {
    await logActivity({
      actorId: session.user.id,
      action: "SUPPORT_ACTION_REFUSED",
      entity: "SupportTicket",
      entityId: ticketId || undefined,
      meta: { action, role: session.user.role },
    });
    return;
  }
  const actorId = session.user.id;

  if (action === "status") {
    const status = text(formData.get("status"), 30);
    if ((SUPPORT_STATUSES as readonly string[]).includes(status)) {
      await staffUpdateTicketStatus({
        ticketId,
        actorId,
        status: status as SupportTicketStatus,
        resolutionSummary: text(formData.get("resolutionSummary"), 2000) || undefined,
      });
    }
  }

  if (action === "reply") {
    await staffAddMessage({
      ticketId,
      authorId: actorId,
      body: text(formData.get("body"), 4000),
      visibility: formData.get("internal") ? "INTERNAL_NOTE" : "DEALER_VISIBLE",
      setAwaitingResponse: Boolean(formData.get("awaiting")),
    });
  }

  if (action === "assign") {
    const department = text(formData.get("department"), 20);
    const priority = text(formData.get("priority"), 20);
    await staffAssignTicket({
      ticketId,
      actorId,
      assigneeId: formData.has("assigneeId") ? text(formData.get("assigneeId"), 40) || null : undefined,
      department: (SUPPORT_DEPARTMENTS as readonly string[]).includes(department)
        ? (department as SupportTicketDepartment)
        : undefined,
      priority: (SUPPORT_PRIORITIES as readonly string[]).includes(priority)
        ? (priority as SupportTicketPriority)
        : undefined,
    });
  }

  if (action === "create-internal") {
    await createTicket({
      origin: "INTERNAL",
      dealerOrganizationId: text(formData.get("dealerOrganizationId"), 40) || null,
      createdById: actorId,
      assigneeId: text(formData.get("assigneeId"), 40) || null,
      subject: text(formData.get("subject"), 200),
      description: text(formData.get("description"), 2000),
      department: text(formData.get("department"), 20),
      priority: text(formData.get("priority"), 20),
      relatedOrderId: text(formData.get("relatedOrderId"), 40) || null,
      uploads: [],
    });
  }

  revalidatePath("/intelligence/retail/support");
}
