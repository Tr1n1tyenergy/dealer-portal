import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermissionApi, jsonError } from "@/lib/api-auth";
import { completeNoteSession, toggleNoteAction } from "@/lib/note-sessions";
import { logActivity } from "@/lib/activity";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";

const patchSchema = z.union([
  z.object({ action: z.enum(["start", "pause", "resume", "stop"]) }),
  z.object({ action: z.literal("toggleAction"), index: z.number().int().min(0).max(500) }),
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionApi("noteSessions", "view");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const isAdmin = auth.session.user.role === "SUPER_ADMIN";

  const session = await prisma.noteSession.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: auth.session.user.id }),
    },
  });

  if (!session) return jsonError("Session not found", 404);
  return NextResponse.json({ session });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionApi("noteSessions", "act");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  if (parsed.data.action === "toggleAction") {
    const doneActions = await toggleNoteAction(id, auth.session.user.id, parsed.data.index);
    if (!doneActions) return jsonError("Action not found", 404);
    return NextResponse.json({ doneActions });
  }

  const existing = await prisma.noteSession.findFirst({
    where: { id, userId: auth.session.user.id },
  });
  if (!existing) return jsonError("Session not found", 404);

  let session;

  switch (parsed.data.action) {
    case "start":
      session = await prisma.noteSession.update({
        where: { id },
        data: {
          status: "RECORDING",
          startedAt: existing.startedAt ?? new Date(),
        },
      });
      break;
    case "pause":
      session = await prisma.noteSession.update({
        where: { id },
        data: { status: "PAUSED" },
      });
      break;
    case "resume":
      session = await prisma.noteSession.update({
        where: { id },
        data: { status: "RECORDING" },
      });
      break;
    case "stop":
      session = await completeNoteSession(id, auth.session.user.id);
      break;
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: `NOTE_SESSION_${parsed.data.action.toUpperCase()}`,
    entity: "NoteSession",
    entityId: id,
  });

  return NextResponse.json({ session });
}
