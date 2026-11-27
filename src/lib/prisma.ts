import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaStamp?: string;
};

/** Bump when schema relations or client options change so HMR drops a stale singleton. */
const PRISMA_SCHEMA_STAMP = "order-booking-kra-2026-11-27";

/**
 * Neon round-trips are often slower than Prisma's 2s wait and 5s body limits.
 * Those defaults expire the transaction (P2028) once a save touches more than a
 * few rows, and the database then rolls the whole save back.
 */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

/**
 * Neon pooler + Turbopack HMR can exhaust default Prisma pools
 * (timeout 10s / limit ~num_cpus*2+1). Cap connections and raise wait time.
 */
function databaseUrlWithPoolDefaults(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connection_limit")) {
      // Dev/serverless: keep low against Neon pooler; production still shares one process singleton
      u.searchParams.set("connection_limit", process.env.NODE_ENV === "production" ? "10" : "5");
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "30");
    }
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "30");
    }
    if (u.hostname.includes("-pooler.") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient() {
  return new PrismaClient({
    datasources: { db: { url: databaseUrlWithPoolDefaults() } },
    transactionOptions: TRANSACTION_OPTIONS,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Delegates that must exist after local SSR / support migrations. */
const REQUIRED_DELEGATES = [
  "stationPumpRttEvent",
  "stockSaleReport",
  "stockSalePumpReading",
  "stockSaleTankReading",
  "supportTicket",
  "stationStockIntelligenceConfig",
  "fleetTruck",
  "fleetTruckCompartment",
  "transportCompany",
  "stationFuelPrice",
  "storedFile",
  "stockReceipt",
] as const;

/**
 * After `prisma generate` adds models, Turbopack can keep a stale global singleton
 * that is missing delegates (e.g. stationPumpRttEvent → findMany on undefined)
 * or whose DMMF lacks new relations (e.g. Station.fuelPrices → PrismaClientValidationError).
 * Recreate when any required delegate / relation is missing.
 */
function modelHasField(client: PrismaClient, model: string, field: string): boolean {
  const runtime = client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, { fields?: Record<string, unknown> | Array<{ name: string }> }>;
    };
  };
  const entry = runtime._runtimeDataModel?.models?.[model];
  if (!entry?.fields) return false;
  if (Array.isArray(entry.fields)) {
    return entry.fields.some((f) => f.name === field);
  }
  return field in entry.fields;
}

function isFreshPrismaClient(client: PrismaClient): boolean {
  const record = client as unknown as Record<string, unknown>;
  if (!REQUIRED_DELEGATES.every((key) => record[key] != null)) return false;
  if (!modelHasField(client, "Station", "fuelPrices")) return false;
  if (!modelHasField(client, "FleetTruck", "transportCompany")) return false;
  if (!modelHasField(client, "FleetTruck", "compartments")) return false;
  if (!modelHasField(client, "StationTank", "pumps")) return false;
  if (!modelHasField(client, "StationPump", "tankId")) return false;
  if (!modelHasField(client, "StationPump", "tank")) return false;
  if (!modelHasField(client, "DealerOrder", "stockReceipt")) return false;
  return true;
}

function resolvePrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const stampOk = globalForPrisma.prismaSchemaStamp === PRISMA_SCHEMA_STAMP;
  if (existing && stampOk && isFreshPrismaClient(existing)) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }
  globalForPrisma.prismaSchemaStamp = PRISMA_SCHEMA_STAMP;
  return createPrismaClient();
}

/** Drop HMR-stale singleton so the next import rebuilds against current generated client. */
export function resetPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }
  const next = createPrismaClient();
  globalForPrisma.prisma = next;
  globalForPrisma.prismaSchemaStamp = PRISMA_SCHEMA_STAMP;
  return next;
}

function getPrisma(): PrismaClient {
  const client = resolvePrismaClient();
  // Keep it in production too: this runs on every `prisma.x` access, so without the cache each
  // query would open a new client and connection pool until Postgres runs out of connections.
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Lazy accessor so Turbopack HMR cannot keep serving a module-scoped
 * PrismaClient constructed against an older generated schema.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
