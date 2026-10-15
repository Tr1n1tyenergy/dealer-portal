/**
 * Database side of a Retail Interface dealer invite: one login for one dealer company,
 * linked to one or more of that company's stations. Station rules live in station-selection.ts.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { daysFromNow, generateSecureToken } from "@/lib/tokens";
import type { StationInviteCatalogRow } from "@/lib/dealers/station-invite-catalog";

type Db = Prisma.TransactionClient | typeof prisma;

export type InviteConflict = { status: 409; message: string };

type InviteTarget = {
  orgCode: string;
  orgName: string;
  rows: StationInviteCatalogRow[];
  email: string;
};

const LIVE_LOGIN = { accountType: "DEALER" as const, status: { in: ["PENDING" as const, "ACTIVE" as const] } };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

class InviteRefused extends Error {
  constructor(readonly conflict: InviteConflict) {
    super(conflict.message);
  }
}

/** orgCode → email of the company's pending or active dealer login. */
export async function findCompanyLogins(orgCodes: string[]): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { ...LIVE_LOGIN, dealerOrganization: { code: { in: orgCodes } } },
    select: { email: true, dealerOrganization: { select: { code: true } } },
    orderBy: { createdAt: "asc" },
  });
  const logins = new Map<string, string>();
  for (const u of users) {
    const code = u.dealerOrganization?.code;
    if (code && !logins.has(code)) logins.set(code, u.email);
  }
  return logins;
}

async function conflictIn(db: Db, target: InviteTarget): Promise<InviteConflict | null> {
  if (await db.user.findUnique({ where: { email: normalizeEmail(target.email) } })) {
    return { status: 409, message: "A user with this email already exists." };
  }

  const login = await db.user.findFirst({
    where: { ...LIVE_LOGIN, dealerOrganization: { code: target.orgCode } },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  if (login) {
    return {
      status: 409,
      message: `${target.orgName} already has a dealer login (${login.email}). Ask an Admin to disable it in Admin → Users before inviting someone else.`,
    };
  }

  const existing = await db.station.findMany({
    where: { code: { in: target.rows.map((r) => r.stationCode) } },
    select: { code: true, dealerOrganization: { select: { code: true, name: true } } },
  });
  for (const station of existing) {
    if (station.dealerOrganization.code === target.orgCode) continue;
    const row = target.rows.find((r) => r.stationCode === station.code);
    return {
      status: 409,
      message: `${row?.stationName ?? station.code} is already linked to ${station.dealerOrganization.name} and can't be moved to ${target.orgName}.`,
    };
  }
  return null;
}

/** Read-only pre-check, so the form can show these errors before anything is written. */
export function findInviteConflict(target: InviteTarget): Promise<InviteConflict | null> {
  return conflictIn(prisma, target);
}

export async function createDealerInvite(
  input: InviteTarget & { firstName: string; lastName: string }
): Promise<
  | {
      ok: true;
      user: { id: string; email: string; firstName: string; lastName: string; status: string };
      token: string;
    }
  | ({ ok: false } & InviteConflict)
> {
  const { orgCode, orgName, rows } = input;
  const email = normalizeEmail(input.email);
  const productsJson = JSON.stringify(rows[0]?.products ?? []);

  try {
    return await prisma.$transaction(async (tx) => {
      // Upsert the company first: its row lock makes a simultaneous invite for the same company
      // wait here, so the login check below sees the other invite's user once it commits.
      const org = await tx.dealerOrganization.upsert({
        where: { code: orgCode },
        create: {
          code: orgCode,
          name: orgName,
          odooPartnerId: rows[0]?.odooPartnerId,
          odooPartnerExternalId: rows[0]?.odooPartnerExternalId,
          products: productsJson,
        },
        update: { name: orgName, products: productsJson },
      });

      const conflict = await conflictIn(tx, { ...input, email });
      if (conflict) throw new InviteRefused(conflict);

      for (const row of rows) {
        const fields = {
          name: row.stationName,
          tradingName: row.tradingName,
          dealerOrganizationId: org.id,
          products: JSON.stringify(row.products),
        };
        await tx.station.upsert({
          where: { code: row.stationCode },
          create: {
            code: row.stationCode,
            ...fields,
            odooPartnerId: row.odooPartnerId,
            odooPartnerExternalId: row.odooPartnerExternalId,
            odooStationExternalId: row.odooStationExternalId,
          },
          update: {
            ...fields,
            odooPartnerId: row.odooPartnerId ?? undefined,
            odooPartnerExternalId: row.odooPartnerExternalId ?? undefined,
            odooStationExternalId: row.odooStationExternalId ?? undefined,
          },
        });
      }

      const user = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email,
          department: "Dealer",
          role: "DEALER_ADMIN",
          accountType: "DEALER",
          status: "PENDING",
          dealerOrganizationId: org.id,
          permissions: "[]",
        },
        select: { id: true, email: true, firstName: true, lastName: true, status: true },
      });

      const token = generateSecureToken();
      await tx.invitationToken.create({ data: { token, userId: user.id, expiresAt: daysFromNow(7) } });

      return { ok: true as const, user, token };
    });
  } catch (error) {
    if (error instanceof InviteRefused) return { ok: false, ...error.conflict };
    // Same email submitted twice at once: the unique index stops the second one.
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, status: 409, message: "A user with this email already exists." };
    }
    throw error;
  }
}
