import {
  Prisma,
  SupportMessageVisibility,
  SupportTicketDepartment,
  SupportTicketEventType,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_DESCRIPTION,
  MAX_SUPPORT_MESSAGE,
  MAX_SUPPORT_SUBJECT,
  SUPPORT_DEPARTMENTS,
  SUPPORT_PRIORITIES,
} from "@/lib/support/constants";
import {
  deleteSupportUpload,
  storeSupportUpload,
  type ValidatedUpload,
} from "@/lib/support/storage";

export type TicketListFilters = {
  status?: SupportTicketStatus | "ALL";
  department?: SupportTicketDepartment | "ALL";
  q?: string;
  dateRange?: "ALL" | "7d" | "30d" | "90d";
};

function assertDept(v: string): SupportTicketDepartment {
  if (!(SUPPORT_DEPARTMENTS as readonly string[]).includes(v)) {
    throw new Error("Select a valid department.");
  }
  return v as SupportTicketDepartment;
}

function assertPriority(v: string): SupportTicketPriority {
  if (!(SUPPORT_PRIORITIES as readonly string[]).includes(v)) {
    throw new Error("Select a valid priority.");
  }
  return v as SupportTicketPriority;
}

async function nextTicketReference(tx: Prisma.TransactionClient) {
  try {
    const row = await tx.supportTicketSequence.update({
      where: { id: "default" },
      data: { lastNumber: { increment: 1 } },
    });
    return `TRN-${row.lastNumber}`;
  } catch {
    const row = await tx.supportTicketSequence.create({
      data: { id: "default", lastNumber: 4581 },
    });
    return `TRN-${row.lastNumber}`;
  }
}

function dateFromRange(range: TicketListFilters["dateRange"]) {
  if (!range || range === "ALL") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function countTicketsForOrg(dealerOrganizationId: string) {
  const groups = await prisma.supportTicket.groupBy({
    by: ["status"],
    where: { dealerOrganizationId },
    _count: { _all: true },
  });
  const byStatus: Record<SupportTicketStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    AWAITING_RESPONSE: 0,
    CLOSED: 0,
  };
  let total = 0;
  for (const g of groups) {
    byStatus[g.status] = g._count._all;
    total += g._count._all;
  }
  return { total, byStatus };
}

export async function listTicketsForOrg(
  dealerOrganizationId: string,
  filters: TicketListFilters = {},
) {
  const where: Prisma.SupportTicketWhereInput = { dealerOrganizationId };
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.department && filters.department !== "ALL") where.department = filters.department;
  const from = dateFromRange(filters.dateRange);
  if (from) where.createdAt = { gte: from };
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.supportTicket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      relatedOrder: { select: { id: true, reference: true } },
      _count: { select: { attachments: true, messages: true } },
    },
  });
}

export async function getTicketForDealer(ticketId: string, dealerOrganizationId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, dealerOrganizationId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, department: true } },
      relatedOrder: { select: { id: true, reference: true, status: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      messages: {
        where: { visibility: SupportMessageVisibility.DEALER_VISIBLE },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, accountType: true, department: true },
          },
          attachments: true,
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      dealerOrganization: { select: { id: true, name: true, code: true } },
    },
  });
  if (!ticket) throw new Error("Ticket not found.");
  return ticket;
}

export async function createTicket(params: {
  dealerOrganizationId: string;
  createdById: string;
  subject: string;
  description: string;
  department: string;
  priority: string;
  relatedOrderId?: string | null;
  uploads: ValidatedUpload[];
}) {
  const subject = params.subject.trim();
  const description = params.description.trim();
  if (subject.length < 4 || subject.length > MAX_SUPPORT_SUBJECT) {
    throw new Error(`Subject must be between 4 and ${MAX_SUPPORT_SUBJECT} characters.`);
  }
  if (description.length < 10 || description.length > MAX_SUPPORT_DESCRIPTION) {
    throw new Error(`Description must be between 10 and ${MAX_SUPPORT_DESCRIPTION} characters.`);
  }
  const department = assertDept(params.department);
  const priority = assertPriority(params.priority);
  if (params.uploads.length > MAX_SUPPORT_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_SUPPORT_ATTACHMENTS} files.`);
  }

  if (params.relatedOrderId) {
    const order = await prisma.dealerOrder.findFirst({
      where: { id: params.relatedOrderId, dealerOrganizationId: params.dealerOrganizationId },
      select: { id: true },
    });
    if (!order) throw new Error("Related order was not found for your dealership.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const reference = await nextTicketReference(tx);
    const ticket = await tx.supportTicket.create({
      data: {
        reference,
        dealerOrganizationId: params.dealerOrganizationId,
        createdById: params.createdById,
        subject,
        description,
        department,
        priority,
        status: SupportTicketStatus.OPEN,
        relatedOrderId: params.relatedOrderId || null,
      },
    });

    await tx.supportTicketEvent.create({
      data: {
        ticketId: ticket.id,
        type: SupportTicketEventType.CREATED,
        toValue: SupportTicketStatus.OPEN,
        actorId: params.createdById,
        note: `Routed to ${department}`,
      },
    });

    return ticket;
  });

  const attachmentIds: string[] = [];
  try {
    for (const upload of params.uploads) {
      const { storageKey } = await storeSupportUpload(created.id, upload);
      const att = await prisma.supportTicketAttachment.create({
        data: {
          ticketId: created.id,
          fileName: upload.fileName,
          storageKey,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          uploadedById: params.createdById,
        },
      });
      attachmentIds.push(att.id);
      await prisma.supportTicketEvent.create({
        data: {
          ticketId: created.id,
          type: SupportTicketEventType.ATTACHMENT_ADDED,
          toValue: upload.fileName,
          actorId: params.createdById,
        },
      });
    }
  } catch (err) {
    // Roll back ticket + files on attachment failure
    for (const id of attachmentIds) {
      const row = await prisma.supportTicketAttachment.findUnique({ where: { id } });
      if (row) await deleteSupportUpload(row.storageKey);
    }
    await prisma.supportTicket.delete({ where: { id: created.id } }).catch(() => undefined);
    throw err instanceof Error ? err : new Error("Could not store attachments.");
  }

  await logActivity({
    actorId: params.createdById,
    action: "support.ticket.create",
    entity: "SupportTicket",
    entityId: created.id,
    meta: {
      reference: created.reference,
      department,
      priority,
      dealerOrganizationId: params.dealerOrganizationId,
    },
  });

  return created;
}

export async function addDealerReply(params: {
  ticketId: string;
  dealerOrganizationId: string;
  authorId: string;
  body: string;
}) {
  const body = params.body.trim();
  if (body.length < 1 || body.length > MAX_SUPPORT_MESSAGE) {
    throw new Error(`Reply must be between 1 and ${MAX_SUPPORT_MESSAGE} characters.`);
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: params.ticketId, dealerOrganizationId: params.dealerOrganizationId },
  });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === SupportTicketStatus.CLOSED) {
    throw new Error("This ticket is closed. Raise a new ticket if you need more help.");
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: params.authorId,
        body,
        visibility: SupportMessageVisibility.DEALER_VISIBLE,
      },
    });
    await tx.supportTicketEvent.create({
      data: {
        ticketId: ticket.id,
        type: SupportTicketEventType.MESSAGE_ADDED,
        actorId: params.authorId,
      },
    });

    // Dealer reply after awaiting response moves ticket back into staff workflow.
    if (ticket.status === SupportTicketStatus.AWAITING_RESPONSE) {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: SupportTicketStatus.IN_PROGRESS },
      });
      await tx.supportTicketEvent.create({
        data: {
          ticketId: ticket.id,
          type: SupportTicketEventType.STATUS_CHANGED,
          fromValue: SupportTicketStatus.AWAITING_RESPONSE,
          toValue: SupportTicketStatus.IN_PROGRESS,
          actorId: params.authorId,
          note: "Dealer replied",
        },
      });
    } else {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      });
    }
    return msg;
  });

  await logActivity({
    actorId: params.authorId,
    action: "support.ticket.reply",
    entity: "SupportTicket",
    entityId: ticket.id,
  });

  return message;
}

/** Staff foundation: list department queue (permission-gated at API layer). */
export async function listTicketsForStaff(filters: {
  department?: SupportTicketDepartment | "ALL";
  status?: SupportTicketStatus | "ALL";
  q?: string;
}) {
  const where: Prisma.SupportTicketWhereInput = {};
  if (filters.department && filters.department !== "ALL") where.department = filters.department;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.supportTicket.findMany({
    where,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    include: {
      dealerOrganization: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 200,
  });
}

export async function staffUpdateTicketStatus(params: {
  ticketId: string;
  actorId: string;
  status: SupportTicketStatus;
  note?: string;
  resolutionSummary?: string;
}) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === params.status) return ticket;

  const data: Prisma.SupportTicketUpdateInput = { status: params.status };
  if (params.status === SupportTicketStatus.IN_PROGRESS && !ticket.reviewedAt) {
    data.reviewedAt = new Date();
  }
  if (params.status === SupportTicketStatus.CLOSED) {
    data.closedAt = new Date();
    data.resolvedAt = ticket.resolvedAt ?? new Date();
    if (params.resolutionSummary?.trim()) data.resolutionSummary = params.resolutionSummary.trim();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.supportTicket.update({ where: { id: ticket.id }, data });
    await tx.supportTicketEvent.create({
      data: {
        ticketId: ticket.id,
        type:
          params.status === SupportTicketStatus.CLOSED
            ? SupportTicketEventType.CLOSED
            : SupportTicketEventType.STATUS_CHANGED,
        fromValue: ticket.status,
        toValue: params.status,
        actorId: params.actorId,
        note: params.note?.trim() || null,
      },
    });
    return row;
  });

  await logActivity({
    actorId: params.actorId,
    action: "support.ticket.status",
    entity: "SupportTicket",
    entityId: ticket.id,
    meta: { from: ticket.status, to: params.status },
  });

  return updated;
}

export async function staffAddMessage(params: {
  ticketId: string;
  authorId: string;
  body: string;
  visibility?: SupportMessageVisibility;
  setAwaitingResponse?: boolean;
}) {
  const body = params.body.trim();
  if (body.length < 1 || body.length > MAX_SUPPORT_MESSAGE) {
    throw new Error(`Message must be between 1 and ${MAX_SUPPORT_MESSAGE} characters.`);
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new Error("Ticket not found.");

  const visibility = params.visibility ?? SupportMessageVisibility.DEALER_VISIBLE;

  return prisma.$transaction(async (tx) => {
    const msg = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: params.authorId,
        body,
        visibility,
      },
    });
    await tx.supportTicketEvent.create({
      data: {
        ticketId: ticket.id,
        type: SupportTicketEventType.MESSAGE_ADDED,
        actorId: params.authorId,
        note: visibility === SupportMessageVisibility.INTERNAL_NOTE ? "Internal note" : null,
      },
    });
    if (
      params.setAwaitingResponse &&
      visibility === SupportMessageVisibility.DEALER_VISIBLE &&
      ticket.status !== SupportTicketStatus.CLOSED
    ) {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: SupportTicketStatus.AWAITING_RESPONSE },
      });
      await tx.supportTicketEvent.create({
        data: {
          ticketId: ticket.id,
          type: SupportTicketEventType.STATUS_CHANGED,
          fromValue: ticket.status,
          toValue: SupportTicketStatus.AWAITING_RESPONSE,
          actorId: params.authorId,
        },
      });
    } else {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      });
    }
    return msg;
  });
}

export async function getAttachmentForAccess(params: {
  ticketId: string;
  attachmentId: string;
  dealerOrganizationId?: string | null;
  isStaff: boolean;
}) {
  const att = await prisma.supportTicketAttachment.findFirst({
    where: { id: params.attachmentId, ticketId: params.ticketId },
    include: { ticket: { select: { dealerOrganizationId: true } } },
  });
  if (!att) throw new Error("Attachment not found.");
  if (!params.isStaff) {
    if (!params.dealerOrganizationId || att.ticket.dealerOrganizationId !== params.dealerOrganizationId) {
      throw new Error("Forbidden.");
    }
  }
  return att;
}
