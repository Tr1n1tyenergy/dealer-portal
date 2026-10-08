#!/usr/bin/env tsx
/**
 * Read-only preflight for production schema migrate deploy.
 * Does not apply migrations, seed, or transfer data.
 *
 * Usage:
 *   TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \\
 *     npm run production:migrate:preflight
 */
import { PrismaClient } from "@prisma/client";
import { loadProductionEnv } from "./load-production-env";
import {
  NEON_PRODUCTION_ENDPOINT_ID,
  NEON_STAGING_ENDPOINT_ID,
  endpointIdFromUrl,
} from "./neon-endpoints";
import fs from "node:fs";
import path from "node:path";

function directUrlWithTimeout(raw: string): string {
  const u = new URL(raw);
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
  return u.toString();
}

async function main() {
  const { target } = loadProductionEnv();

  const migrationDir = path.resolve(process.cwd(), "prisma/migrations");
  const initSql = path.join(migrationDir, "20261008120000_init_postgresql/migration.sql");
  const lockFile = path.join(migrationDir, "migration_lock.toml");

  const localChecks = {
    migrationSqlExists: fs.existsSync(initSql),
    migrationLockExists: fs.existsSync(lockFile),
    migrationLockProvider: fs.existsSync(lockFile)
      ? fs.readFileSync(lockFile, "utf8").includes('provider = "postgresql"')
      : false,
    expectedEndpoint: NEON_PRODUCTION_ENDPOINT_ID,
    forbiddenStagingEndpoint: NEON_STAGING_ENDPOINT_ID,
    loadedEndpoint: target.endpointId,
    envFile: target.envFile,
    databaseUrlIsPooler: target.databaseUrlIsPooler,
    directUrlIsPooler: target.directUrlIsPooler,
    parsedDirectEndpoint: endpointIdFromUrl(process.env.DIRECT_URL!),
    parsedDatabaseEndpoint: endpointIdFromUrl(process.env.DATABASE_URL!),
  };

  console.info("[production-preflight] Local checks:");
  for (const [k, v] of Object.entries(localChecks)) {
    console.info(`  ${k}=${String(v)}`);
  }

  if (
    !localChecks.migrationSqlExists ||
    !localChecks.migrationLockExists ||
    !localChecks.migrationLockProvider
  ) {
    throw new Error("Local Prisma migration files incomplete or not PostgreSQL.");
  }
  if (localChecks.loadedEndpoint !== NEON_PRODUCTION_ENDPOINT_ID) {
    throw new Error("Loaded endpoint is not the confirmed production endpoint.");
  }
  if (
    localChecks.parsedDirectEndpoint === NEON_STAGING_ENDPOINT_ID ||
    localChecks.parsedDatabaseEndpoint === NEON_STAGING_ENDPOINT_ID
  ) {
    throw new Error("Staging endpoint detected — aborting.");
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrlWithTimeout(process.env.DIRECT_URL!) } },
  });

  try {
    await prisma.$connect();

    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY 1
    `);

    const migrationsTable = tables.some((t) => t.table_name === "_prisma_migrations");
    let migrationRows = 0;
    if (migrationsTable) {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT COUNT(*)::int AS n FROM "_prisma_migrations"`
      );
      migrationRows = rows[0]?.n ?? 0;
    }

    console.info("[production-preflight] Remote schema (read-only):");
    console.info(`  public_table_count=${tables.length}`);
    console.info(`  public_tables=${tables.map((t) => t.table_name).join(",") || "(none)"}`);
    console.info(`  prisma_migrations_table_exists=${migrationsTable}`);
    console.info(`  prisma_migrations_row_count=${migrationRows}`);

    const emptyPublic =
      tables.length === 0 || (tables.length === 1 && migrationsTable && migrationRows === 0);
    // User stated zero tables and no _prisma_migrations — expect fully empty public schema
    const readyForInitialDeploy = tables.length === 0 && !migrationsTable;

    if (readyForInitialDeploy) {
      console.info(
        "[production-preflight] PASS — production public schema is empty; safe candidate for initial `prisma migrate deploy` (after approval)."
      );
      console.info(
        "[production-preflight] This preflight does NOT apply migrations and does NOT transfer data."
      );
      return;
    }

    console.warn(
      "[production-preflight] WARNING — public schema is not empty. Inspect before any migrate deploy."
    );
    if (!emptyPublic) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(
    "[production-preflight] FAILED:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
