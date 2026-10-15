import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import {
  EmailDeliveryError,
  emailDeliveryConfigured,
  invitationEmailHtml,
  sendEmail,
} from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { mayExposeSensitiveAuthUrls } from "@/lib/security/expose-sensitive-urls";
import { listStationInviteCatalog } from "@/lib/dealers/station-invite-catalog";
import { checkStationSelection } from "@/lib/dealers/station-selection";
import { createDealerInvite, findInviteConflict } from "@/lib/dealers/dealer-invite";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";

const schema = z.object({
  stationCodes: z.array(z.string().min(1).max(100)).max(20).default([]),
  email: z.string().max(254).email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  const body = await readJson(req);

  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  // Rule checks come before the email check so staff always see why an invite is refused.
  const selection = checkStationSelection(listStationInviteCatalog(), parsed.data.stationCodes);
  if (!selection.ok) return jsonError(selection.message, selection.status);

  const target = {
    orgCode: selection.orgCode,
    orgName: selection.orgName,
    rows: selection.rows,
    email: parsed.data.email,
  };
  const conflict = await findInviteConflict(target);
  if (conflict) return jsonError(conflict.message, conflict.status);

  if (!emailDeliveryConfigured()) {
    return jsonError(
      "Email delivery is not configured. Set RESEND_API_KEY before inviting dealers.",
      503
    );
  }

  const created = await createDealerInvite({
    ...target,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
  });
  if (!created.ok) return jsonError(created.message, created.status);
  const { user, token } = created;
  const stationCodes = selection.rows.map((r) => r.stationCode);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const activateUrl = `${baseUrl}/dealer/activate?token=${token}`;

  try {
    await sendEmail({
      to: user.email,
      subject: "Activate your Trinity Dealer Portal account",
      html: invitationEmailHtml({ firstName: user.firstName, activateUrl }),
    });
  } catch (err) {
    await prisma.invitationToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    const message =
      err instanceof EmailDeliveryError ? err.message : "Invitation email could not be sent.";
    return jsonError(message, 503);
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: "DEALER_INVITED",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email, stationCodes },
  });

  const payload: Record<string, unknown> = {
    user: {
      ...user,
      stationCodes,
      tradingNames: selection.rows.map((r) => r.tradingName),
    },
    invitationSent: true,
  };
  if (mayExposeSensitiveAuthUrls()) {
    payload.activateUrl = activateUrl;
  }

  return NextResponse.json(payload, { status: 201 });
}
