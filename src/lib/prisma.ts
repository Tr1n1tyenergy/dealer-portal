import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

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
] as const;

/**
 * After `prisma generate` adds models, Turbopack can keep a stale global singleton
 * that is missing delegates (e.g. stationPumpRttEvent → findMany on undefined).
 * Recreate when any required delegate is missing.
 */
function isFreshPrismaClient(client: PrismaClient): boolean {
  const record = client as unknown as Record<string, unknown>;
  return REQUIRED_DELEGATES.every((key) => record[key] != null);
}

function resolvePrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && isFreshPrismaClient(existing)) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }
  return createPrismaClient();
}

export const prisma = resolvePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
