import { prisma } from "@/lib/prisma";
import type { FleetTruckStatus } from "@prisma/client";
import type {
  FleetTruckRow,
  FleetTruckStatusValue,
  TransportCompanyOpt,
} from "@/lib/settings/fleet-truck-types";

export type {
  FleetTruckRow,
  FleetTruckStats,
  FleetTruckStatusValue,
  FleetTruckCompartmentRow,
  TransportCompanyOpt,
} from "@/lib/settings/fleet-truck-types";
export { computeFleetStats } from "@/lib/settings/fleet-truck-types";

function toStatus(s: FleetTruckStatus): FleetTruckStatusValue {
  return s;
}

/** Active transport companies created from typed truck names (no dealer auto-seed). */
export async function listTransportCompanies(): Promise<TransportCompanyOpt[]> {
  return prisma.transportCompany.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function listFleetTrucks(): Promise<FleetTruckRow[]> {
  const rows = await prisma.fleetTruck.findMany({
    orderBy: [{ truckNumber: "asc" }],
    include: {
      transportCompany: { select: { id: true, name: true } },
      dealerOrganization: { select: { id: true, name: true } },
      station: { select: { id: true, name: true } },
      compartments: { orderBy: { compartmentNumber: "asc" } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    truckNumber: t.truckNumber,
    registrationNumber: t.registrationNumber,
    transportCompanyId: t.transportCompanyId,
    transportCompanyName: t.transportCompany?.name ?? "—",
    dealerOrganizationId: t.dealerOrganizationId,
    dealerName: t.dealerOrganization?.name ?? "—",
    stationId: t.stationId,
    stationName: t.station?.name ?? "—",
    capacityLitres: t.capacityLitres,
    status: toStatus(t.status),
    truckType: t.truckType,
    driverName: t.driverName,
    driverId: t.driverId,
    driverContact: t.driverContact,
    notes: t.notes,
    compartments: t.compartments.map((c) => ({
      id: c.id,
      compartmentNumber: c.compartmentNumber,
      capacityLitres: c.capacityLitres,
    })),
    createdAt: t.createdAt.toISOString(),
  }));
}
