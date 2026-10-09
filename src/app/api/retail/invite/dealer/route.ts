import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { generateSecureToken, daysFromNow } from "@/lib/tokens";
import {
  EmailDeliveryError,
  emailDeliveryConfigured,
  invitationEmailHtml,
  sendEmail,
} from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { mayExposeSensitiveAuthUrls } from "@/lib/security/expose-sensitive-urls";
import { getStationInviteRow } from "@/lib/dealers/station-invite-catalog";

const schema = z.object({
  stationCode: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  if (!emailDeliveryConfigured()) {
    return jsonError(
      "Email delivery is not configured. Set RESEND_API_KEY before inviting dealers.",
      503
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const catalog = getStationInviteRow(parsed.data.stationCode);
  if (!catalog) return jsonError("Unknown station code.", 400);
  if (!catalog.invitable) {
    return jsonError(
      `Station "${catalog.stationName}" is not invitable yet — partner and station External IDs are required.`,
      400
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("A user with this email already exists.", 409);

  const productsJson = JSON.stringify(catalog.products);

  const org = await prisma.dealerOrganization.upsert({
    where: { code: catalog.orgCode },
    create: {
      code: catalog.orgCode,
      name: catalog.orgName,
      odooPartnerId: catalog.odooPartnerId,
      odooPartnerExternalId: catalog.odooPartnerExternalId,
      products: productsJson,
    },
    update: {
      name: catalog.orgName,
      odooPartnerId: catalog.odooPartnerId ?? undefined,
      odooPartnerExternalId: catalog.odooPartnerExternalId ?? undefined,
      products: productsJson,
    },
  });

  await prisma.station.upsert({
    where: { code: catalog.stationCode },
    create: {
      code: catalog.stationCode,
      name: catalog.stationName,
      tradingName: catalog.tradingName,
      dealerOrganizationId: org.id,
      odooPartnerId: catalog.odooPartnerId,
      odooPartnerExternalId: catalog.odooPartnerExternalId,
      odooStationExternalId: catalog.odooStationExternalId,
      products: productsJson,
    },
    update: {
      name: catalog.stationName,
      tradingName: catalog.tradingName,
      dealerOrganizationId: org.id,
      odooPartnerId: catalog.odooPartnerId ?? undefined,
      odooPartnerExternalId: catalog.odooPartnerExternalId ?? undefined,
      odooStationExternalId: catalog.odooStationExternalId ?? undefined,
      products: productsJson,
    },
  });

  const user = await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      department: "Dealer",
      role: "DEALER_ADMIN",
      accountType: "DEALER",
      status: "PENDING",
      dealerOrganizationId: org.id,
      permissions: "[]",
    },
  });

  const token = generateSecureToken();
  await prisma.invitationToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: daysFromNow(7),
    },
  });

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
    meta: { email: user.email, stationCode: catalog.stationCode },
  });

  const payload: Record<string, unknown> = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      stationCode: catalog.stationCode,
      tradingName: catalog.tradingName,
    },
    invitationSent: true,
  };
  if (mayExposeSensitiveAuthUrls()) {
    payload.activateUrl = activateUrl;
  }

  return NextResponse.json(payload, { status: 201 });
}
