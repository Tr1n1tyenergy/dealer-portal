import { NextResponse } from "next/server";
import { jsonError, requireDealerApi, requirePermissionApi, requireSessionApi } from "@/lib/api-auth";
import { isStaffAccount } from "@/lib/access";
import { attachmentDownloadError } from "@/lib/support/attachment-errors";
import { getAttachmentForAccess } from "@/lib/support/service";
import { readSupportUpload } from "@/lib/support/storage";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const sessionAuth = await requireSessionApi();
  if ("error" in sessionAuth) return sessionAuth.error;

  const { id, attachmentId } = await ctx.params;
  const user = sessionAuth.session.user;
  const isStaff = isStaffAccount(user.accountType);

  if (isStaff) {
    const staff = await requirePermissionApi("support", "view");
    if ("error" in staff) return staff.error;
  } else {
    const dealer = await requireDealerApi();
    if ("error" in dealer) return dealer.error;
  }

  try {
    const att = await getAttachmentForAccess({
      ticketId: id,
      attachmentId,
      dealerOrganizationId: user.dealerOrganizationId,
      isStaff,
    });
    const buf = await readSupportUpload(att.storageKey);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Length": String(att.sizeBytes),
        "Content-Disposition": `attachment; filename="${att.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const { message, status } = attachmentDownloadError(err);
    if (status === 404 && message === "Not found") console.error("[support] attachment download failed", err);
    return jsonError(message, status);
  }
}
