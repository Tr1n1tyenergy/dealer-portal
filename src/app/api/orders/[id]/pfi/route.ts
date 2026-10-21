import { NextResponse } from "next/server";
import { jsonError, requireSessionApi } from "@/lib/api-auth";
import { canOpenPfi } from "@/lib/orders/pfi-access";
import { loadPfiDocument } from "@/lib/orders/pfi-document";
import { renderPfiPdf } from "@/lib/orders/pfi-pdf";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** The order's PFI as a PDF. Anyone who may not see it gets "Not found", so order ids don't leak. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const loaded = await loadPfiDocument(id);
  if (!loaded || !canOpenPfi(auth.session.user, loaded.dealerOrganizationId)) {
    return jsonError("Not found", 404);
  }

  const pdf = await renderPfiPdf(loaded.document);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="PFI-${loaded.document.number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
