import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionApi, jsonError } from "@/lib/api-auth";
import { listMessages, markConversationRead, sendMessage } from "@/lib/messaging/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const before = new URL(req.url).searchParams.get("before") ?? undefined;

  try {
    const messages = await listMessages(id, auth.session.user.id, 50, before);
    await markConversationRead(id, auth.session.user.id);
    return NextResponse.json({ messages });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Forbidden", 403);
  }
}

const sendSchema = z.object({
  body: z.string().min(1).max(8000),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const parsed = sendSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  try {
    const message = await sendMessage(id, auth.session.user.id, parsed.data.body);
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    return jsonError(msg, msg === "Forbidden" ? 403 : 400);
  }
}
