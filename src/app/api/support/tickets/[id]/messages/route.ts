import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireDealerApi } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { addDealerReply } from "@/lib/support/service";
import { MAX_SUPPORT_MESSAGE } from "@/lib/support/constants";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().trim().min(1).max(MAX_SUPPORT_MESSAGE),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const raw = await readJson(req);
  if (raw === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  try {
    const message = await addDealerReply({
      ticketId: id,
      dealerOrganizationId: auth.session.user.dealerOrganizationId!,
      authorId: auth.session.user.id,
      body: parsed.data.body,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not send reply";
    const status = msg === "Ticket not found." ? 404 : 400;
    return jsonError(msg, status);
  }
}
