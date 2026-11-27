import { NextResponse } from "next/server";
import { jsonError, requireSessionApi } from "@/lib/api-auth";
import { getStoredFile } from "@/lib/files/stored-files";
import { canOpenOrderDocument } from "@/lib/orders/document-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const KINDS = ["etims-invoice", "sale-order", "loading-order", "gate-pass"] as const;

type Ctx = { params: Promise<{ id: string; kind: string }> };

/** A stored order PDF. The same answer for a missing file and a viewer who may not see it. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;
  const { id, kind } = await ctx.params;
  if (!(KINDS as readonly string[]).includes(kind)) return jsonError("Not found", 404);

  const order = await prisma.dealerOrder.findUnique({
    where: { id },
    select: {
      dealerOrganizationId: true,
      depotId: true,
      documents: { where: { kind }, take: 1 },
    },
  });
  const document = order?.documents[0];
  if (!order || !document || !canOpenOrderDocument(auth.session.user, order, kind)) {
    return jsonError("Not found", 404);
  }

  const bytes = await getStoredFile(document.storagePath, process.cwd());
  const fileName = document.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
