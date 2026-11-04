import { prisma } from "@/lib/prisma";
import { itemHash } from "./home-items";

type Result = { ok: true } | { ok: false; status: 403 | 404; message: string };

/** Tick (or untick) an action item from one of the person's own meetings. Ticking twice is harmless. */
export async function setActionDone(userId: string, noteSessionId: string, text: string, done: boolean): Promise<Result> {
  const session = await prisma.noteSession.findUnique({ where: { id: noteSessionId }, select: { userId: true } });
  if (!session) return { ok: false, status: 404, message: "Meeting not found" };
  if (session.userId !== userId) return { ok: false, status: 403, message: "Forbidden" };
  const key = { userId, noteSessionId, itemHash: itemHash(text) };
  if (done) await prisma.actionItemDone.upsert({ where: { userId_noteSessionId_itemHash: key }, create: key, update: {} });
  else await prisma.actionItemDone.deleteMany({ where: key });
  return { ok: true };
}
