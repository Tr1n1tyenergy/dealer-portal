import { prisma } from "@/lib/prisma";
import { listStationInviteCatalog } from "@/lib/dealers/station-invite-catalog";

/**
 * Ensure every official-catalog station exists in the DB (with its dealer org).
 * Staff Stock Sale Reporting lists all mapped stations; local/staging DBs often
 * only have a handful of activated stations until seed/sync runs.
 */
export async function ensureOfficialStationsInDb(): Promise<number> {
  const catalog = listStationInviteCatalog();
  const existingCount = await prisma.station.count();
  if (existingCount >= catalog.length) return existingCount;

  for (const row of catalog) {
    const org = await prisma.dealerOrganization.upsert({
      where: { code: row.orgCode },
      create: {
        code: row.orgCode,
        name: row.orgName,
        products: JSON.stringify(row.products),
        odooPartnerId: row.odooPartnerId,
      },
      update: {
        name: row.orgName,
        ...(row.odooPartnerId != null ? { odooPartnerId: row.odooPartnerId } : {}),
      },
    });

    await prisma.station.upsert({
      where: { code: row.stationCode },
      create: {
        code: row.stationCode,
        name: row.stationName,
        tradingName: row.tradingName,
        dealerOrganizationId: org.id,
        products: JSON.stringify(row.products),
        odooPartnerId: row.odooPartnerId,
        odooPartnerExternalId: row.odooPartnerExternalId,
        odooStationExternalId: row.odooStationExternalId,
      },
      update: {
        name: row.stationName,
        tradingName: row.tradingName,
        dealerOrganizationId: org.id,
        ...(row.odooPartnerId != null ? { odooPartnerId: row.odooPartnerId } : {}),
        ...(row.odooPartnerExternalId
          ? { odooPartnerExternalId: row.odooPartnerExternalId }
          : {}),
        ...(row.odooStationExternalId
          ? { odooStationExternalId: row.odooStationExternalId }
          : {}),
      },
    });
  }

  return prisma.station.count();
}
