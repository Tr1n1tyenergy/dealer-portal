import { NextResponse } from "next/server";
import { SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import { jsonError, requirePermissionApi } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { prisma } from "@/lib/prisma";
import { staffUpdateTicketStatus } from "@/lib/support/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePermissionApi("support", "view");
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, department: true } },
      dealerOrganization: { select: { id: true, name: true, code: true } },
      relatedOrder: { select: { id: true, reference: true, status: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, accountType: true, department: true },
          },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return jsonError("Ticket not found.", 404);
  return NextResponse.json({ ticket });
}

const patchSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus),
  note: z.string().trim().max(1000).optional(),
  resolutionSummary: z.string().trim().max(4000).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requirePermissionApi("support", "act");
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const raw = await readJson(req);
  if (raw === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  try {
    const ticket = await staffUpdateTicketStatus({
      ticketId: id,
      actorId: auth.session.user.id,
      status: parsed.data.status,
      note: parsed.data.note,
      resolutionSummary: parsed.data.resolutionSummary,
    });
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Update failed", 400);
  }
}
