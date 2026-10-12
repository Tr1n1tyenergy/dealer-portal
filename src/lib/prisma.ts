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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrlWithPoolDefaults() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
