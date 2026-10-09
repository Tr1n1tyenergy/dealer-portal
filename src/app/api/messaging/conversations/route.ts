import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionApi, jsonError } from "@/lib/api-auth";
import {
  getOrCreateDirectConversation,
  listConversationsForUser,
} from "@/lib/messaging/service";

export async function GET() {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const conversations = await listConversationsForUser(auth.session.user.id);
  return NextResponse.json({ conversations });
}

const createSchema = z.object({
  peerUserId: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  try {
    const conversation = await getOrCreateDirectConversation(
      auth.session.user.id,
      parsed.data.peerUserId
    );
    return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not create conversation", 400);
  }
}
