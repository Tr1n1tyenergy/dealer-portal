/**
 * Explicit loader for production Neon credentials.
 *
 * Loads ONLY from `.env.production.local` (preferred) or `.env.production`.
 * Never loads `.env.staging` or falls back to staging endpoints.
 *
 * Hard requirements:
 * - DATABASE_URL + DIRECT_URL present
 * - Both URLs must resolve to endpoint `ep-quiet-wildflower-zaag2pmh`
 * - Staging endpoint `ep-old-shape-zacn3ikk` is always rejected
 * - Operator must set TRI_CONFIRM_PRODUCTION_ENDPOINT to the production endpoint id
 * - Deploy additionally requires TRI_ALLOW_PRODUCTION_MIGRATE=1
 *
 * Does not print secret values.
 */
import fs from "node:fs";
import path from "node:path";
import {
  NEON_PRODUCTION_ENDPOINT_ID,
  NEON_STAGING_ENDPOINT_ID,
  endpointIdFromUrl,
  isPoolerUrl,
  isSqliteUrl,
} from "./neon-endpoints";

const CANDIDATES = [
  path.resolve(process.cwd(), ".env.production.local"),
  path.resolve(process.cwd(), ".env.production"),
];

export type ProductionDbTarget = {
  endpointId: string;
  databaseUrlIsPooler: boolean;
  directUrlIsPooler: boolean;
  dbName: string | null;
  envFile: string;
};

function parseEnvFile(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const loaded: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    loaded.push(key);
  }
  return loaded;
}

function dbNameFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, "") || null;
  } catch {
    return null;
  }
}

function assertProductionUrls() {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  if (!databaseUrl || !directUrl) {
    throw new Error("DATABASE_URL and DIRECT_URL are required in the production env file.");
  }
  if (isSqliteUrl(databaseUrl) || isSqliteUrl(directUrl)) {
    throw new Error("Refusing SQLite/file URLs for production.");
  }

  const dbEp = endpointIdFromUrl(databaseUrl);
  const directEp = endpointIdFromUrl(directUrl);

  if (!dbEp || !directEp) {
    throw new Error("Could not parse Neon endpoint IDs from production DATABASE_URL / DIRECT_URL.");
  }
  if (dbEp === NEON_STAGING_ENDPOINT_ID || directEp === NEON_STAGING_ENDPOINT_ID) {
    throw new Error(
      `Refusing staging endpoint ${NEON_STAGING_ENDPOINT_ID}. Production migrate must use ${NEON_PRODUCTION_ENDPOINT_ID} only.`
    );
  }
  if (dbEp !== NEON_PRODUCTION_ENDPOINT_ID || directEp !== NEON_PRODUCTION_ENDPOINT_ID) {
    throw new Error(
      `Production migrate requires endpoint ${NEON_PRODUCTION_ENDPOINT_ID}. Got DATABASE_URL=${dbEp}, DIRECT_URL=${directEp}.`
    );
  }
  if (dbEp !== directEp) {
    throw new Error("DATABASE_URL and DIRECT_URL endpoint IDs differ — refusing mixed-branch config.");
  }
  if (!isPoolerUrl(databaseUrl)) {
    throw new Error("DATABASE_URL must be the Neon pooled (-pooler) endpoint.");
  }
  if (isPoolerUrl(directUrl)) {
    throw new Error("DIRECT_URL must be the Neon direct (non-pooler) endpoint for migrate deploy.");
  }

  const confirm = process.env.TRI_CONFIRM_PRODUCTION_ENDPOINT?.trim();
  if (confirm !== NEON_PRODUCTION_ENDPOINT_ID) {
    throw new Error(
      `Set TRI_CONFIRM_PRODUCTION_ENDPOINT=${NEON_PRODUCTION_ENDPOINT_ID} to acknowledge the production target (got ${confirm ? "mismatched value" : "unset"}).`
    );
  }
}

/** Load production env for migrate / preflight. Does not enable migrate deploy by itself. */
export function loadProductionEnv(): {
  loaded: string[];
  path: string;
  target: ProductionDbTarget;
} {
  const filePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!filePath) {
    throw new Error(
      "Missing .env.production.local (preferred) or .env.production. " +
        "Create it with Neon production DATABASE_URL + DIRECT_URL only. Do not copy .env.staging."
    );
  }

  // Prevent accidental inheritance of a previously loaded staging URL in the same shell
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;

  const loaded = parseEnvFile(filePath);
  assertProductionUrls();

  // Never enable live Odoo or outbound email during local production DB ops
  process.env.ODOO_MODE = "mock";
  delete process.env.RESEND_API_KEY;

  const databaseUrl = process.env.DATABASE_URL!;
  const directUrl = process.env.DIRECT_URL!;
  const target: ProductionDbTarget = {
    endpointId: NEON_PRODUCTION_ENDPOINT_ID,
    databaseUrlIsPooler: isPoolerUrl(databaseUrl),
    directUrlIsPooler: isPoolerUrl(directUrl),
    dbName: dbNameFromUrl(databaseUrl) ?? dbNameFromUrl(directUrl),
    envFile: path.basename(filePath),
  };

  return { loaded, path: filePath, target };
}

/** Extra gate for destructive schema apply (migrate deploy only). */
export function assertProductionMigrateAllowed() {
  if (process.env.TRI_ALLOW_PRODUCTION_MIGRATE !== "1") {
    throw new Error(
      "Refusing production migrate deploy. Set TRI_ALLOW_PRODUCTION_MIGRATE=1 for this command only after preflight passes."
    );
  }
  // Re-assert endpoint confirmation on every deploy
  assertProductionUrls();
}
