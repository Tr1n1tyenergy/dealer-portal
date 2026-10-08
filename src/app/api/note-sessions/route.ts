import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionApi, jsonError } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(["schedule", "instant"]),
  scheduledAt: z.string().datetime().optional(),
  timeLimitSeconds: z.number().int().positive().nullable().optional(),
  participants: z.array(z.string()).default([]),
});

export async function GET() {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const isAdmin = auth.session.user.role === "SUPER_ADMIN";
  const sessions = await prisma.noteSession.findMany({
    where: isAdmin ? undefined : { userId: auth.session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const session = await prisma.noteSession.create({
    data: {
      name: parsed.data.name,
      userId: auth.session.user.id,
      status: parsed.data.mode === "schedule" ? "SCHEDULED" : "COUNTDOWN",
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      timeLimitSeconds: parsed.data.timeLimitSeconds ?? null,
      participants: JSON.stringify(parsed.data.participants),
    },
  });

  await logActivity({
    actorId: auth.session.user.id,
    action: "NOTE_SESSION_CREATED",
    entity: "NoteSession",
    entityId: session.id,
  });

  return NextResponse.json({ session }, { status: 201 });
}
