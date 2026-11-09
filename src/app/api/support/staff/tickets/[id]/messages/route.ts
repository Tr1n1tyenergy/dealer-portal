import { NextResponse } from "next/server";
import { SupportMessageVisibility } from "@prisma/client";
import { z } from "zod";
import { jsonError, requirePermissionApi } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { MAX_SUPPORT_MESSAGE } from "@/lib/support/constants";
import { staffAddMessage } from "@/lib/support/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().trim().min(1).max(MAX_SUPPORT_MESSAGE),
  visibility: z.nativeEnum(SupportMessageVisibility).optional(),
  setAwaitingResponse: z.boolean().optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requirePermissionApi("support", "act");
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const raw = await readJson(req);
  if (raw === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  try {
    const message = await staffAddMessage({
      ticketId: id,
      authorId: auth.session.user.id,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
      setAwaitingResponse: parsed.data.setAwaitingResponse,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not post message", 400);
  }
}
