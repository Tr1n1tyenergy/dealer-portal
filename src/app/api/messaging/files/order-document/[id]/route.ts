import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireMessagingApi, jsonError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { assertParticipant } from "@/lib/messaging/service";
import { canOpenPfi } from "@/lib/orders/pfi-access";

type Ctx = { params: Promise<{ id: string }> };

function resolveSafePath(storagePath: string) {
  const candidates = [
    storagePath,
    path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath),
    path.join(process.cwd(), "uploads", storagePath),
    path.join(process.cwd(), "storage", storagePath),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
  }
  return null;
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireMessagingApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const doc = await prisma.orderDocument.findUnique({
    where: { id },
    include: {
      order: { select: { dealerOrganizationId: true } },
    },
  });
  if (!doc) return jsonError("Not found", 404);

  const viewer = await prisma.user.findUnique({
    where: { id: auth.session.user.id },
    select: { accountType: true, role: true, permissions: true, dealerOrganizationId: true },
  });
  if (!viewer || !canOpenPfi(viewer, doc.order.dealerOrganizationId)) return jsonError("Forbidden", 403);

  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (conversationId) {
    const ok = await assertParticipant(conversationId, auth.session.user.id);
    if (!ok) return jsonError("Forbidden", 403);
  }

  const filePath = resolveSafePath(doc.storagePath);
  if (!filePath) {
    return jsonError("File is not available on this server.", 404);
  }

  const bytes = readFileSync(filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
    },
  });
}
