export type FleetTruckStatusValue = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export type FleetTruckCompartmentRow = {
  id: string;
  compartmentNumber: number;
  capacityLitres: number;
};

export type TransportCompanyOpt = {
  id: string;
  name: string;
};

export type FleetTruckRow = {
  id: string;
  truckNumber: string;
  registrationNumber: string;
  transportCompanyId: string | null;
  transportCompanyName: string;
  dealerOrganizationId: string | null;
  dealerName: string;
  stationId: string | null;
  stationName: string;
  capacityLitres: number;
  status: FleetTruckStatusValue;
  truckType: string | null;
  driverName: string | null;
  driverId: string | null;
  driverContact: string | null;
  notes: string | null;
  compartments: FleetTruckCompartmentRow[];
  createdAt: string;
};

export type FleetTruckStats = {
  total: number;
  active: number;
  maintenance: number;
  inactive: number;
};

export function computeFleetStats(trucks: FleetTruckRow[]): FleetTruckStats {
  return {
    total: trucks.length,
    active: trucks.filter((t) => t.status === "ACTIVE").length,
    maintenance: trucks.filter((t) => t.status === "MAINTENANCE").length,
    inactive: trucks.filter((t) => t.status === "INACTIVE").length,
  };
}
