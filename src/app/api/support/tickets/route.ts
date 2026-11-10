import { NextResponse } from "next/server";
import {
  SupportTicketDepartment,
  SupportTicketStatus,
} from "@prisma/client";
import { jsonError, requireDealerApi } from "@/lib/api-auth";
import { supportUploadProblem } from "@/lib/support/constants";
import { createTicket, listTicketsForOrg } from "@/lib/support/service";
import { validateSupportUpload } from "@/lib/support/storage";

export async function GET(req: Request) {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "ALL") as SupportTicketStatus | "ALL";
  const department = (url.searchParams.get("department") || "ALL") as
    | SupportTicketDepartment
    | "ALL";
  const dateRange = (url.searchParams.get("dateRange") || "ALL") as "ALL" | "7d" | "30d" | "90d";
  const q = url.searchParams.get("q") || "";

  const tickets = await listTicketsForOrg(auth.session.user.dealerOrganizationId!, {
    status,
    department,
    dateRange,
    q,
  });

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      reference: t.reference,
      subject: t.subject,
      department: t.department,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      relatedOrder: t.relatedOrder,
      attachmentCount: t._count.attachments,
      messageCount: t._count.messages,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected multipart form data.", 400);
  }

  const subject = String(form.get("subject") ?? "");
  const description = String(form.get("description") ?? "");
  const department = String(form.get("department") ?? "");
  const priority = String(form.get("priority") ?? "");
  const relatedOrderId = String(form.get("relatedOrderId") ?? "").trim() || null;

  const files = form
    .getAll("attachments")
    .filter((f): f is File => typeof File !== "undefined" && f instanceof File && f.size > 0);

  const uploadProblem = supportUploadProblem(files.map((f) => f.size));
  if (uploadProblem) return jsonError(uploadProblem, 400);

  try {
    const uploads = [];
    for (const file of files) {
      uploads.push(await validateSupportUpload(file));
    }

    const ticket = await createTicket({
      dealerOrganizationId: auth.session.user.dealerOrganizationId!,
      createdById: auth.session.user.id,
      subject,
      description,
      department,
      priority,
      relatedOrderId,
      uploads,
    });

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          reference: ticket.reference,
          department: ticket.department,
          priority: ticket.priority,
          status: ticket.status,
          createdAt: ticket.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not create ticket", 400);
  }
}
