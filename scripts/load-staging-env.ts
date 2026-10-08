/**
 * Explicit loader for .env.staging — Prisma/Next.js do NOT load this file by default.
 * Usage (from package scripts):
 *   tsx scripts/run-with-staging-env.ts <command> [args...]
 */
import fs from "node:fs";
import path from "node:path";
import {
  NEON_PRODUCTION_ENDPOINT_ID,
  NEON_STAGING_ENDPOINT_ID,
  endpointIdFromUrl,
} from "./neon-endpoints";

const STAGING_ENV_PATH = path.resolve(process.cwd(), ".env.staging");

export type StagingDbTarget = {
  endpointId: string | null;
  databaseUrlIsPooler: boolean;
  directUrlIsPooler: boolean;
  dbName: string | null;
};

function summarizeUrl(url: string): {
  isSqlite: boolean;
  isPooler: boolean;
  endpointId: string | null;
  dbName: string | null;
} {
  if (/^file:/i.test(url) || /\.db(\?|$)/i.test(url)) {
    return { isSqlite: true, isPooler: false, endpointId: null, dbName: null };
  }
  try {
    const u = new URL(url);
    return {
      isSqlite: u.protocol === "file:",
      isPooler: u.hostname.includes("-pooler"),
      endpointId: u.hostname.match(/^(ep-[a-z0-9-]+?)(?:-pooler)?\./)?.[1] ?? null,
      dbName: u.pathname.replace(/^\//, "") || null,
    };
  } catch {
    return { isSqlite: /sqlite|\.db/i.test(url), isPooler: false, endpointId: null, dbName: null };
  }
}

/** Redacted DB target for operator logs — never includes credentials. */
export function getStagingDbTarget(): StagingDbTarget {
  const db = summarizeUrl(process.env.DATABASE_URL ?? "");
  const direct = summarizeUrl(process.env.DIRECT_URL ?? "");
  return {
    endpointId: db.endpointId ?? direct.endpointId,
    databaseUrlIsPooler: db.isPooler,
    directUrlIsPooler: direct.isPooler,
    dbName: db.dbName ?? direct.dbName,
  };
}

/** Parse KEY=VALUE lines; does not print values. */
export function loadStagingEnv(filePath = STAGING_ENV_PATH): {
  loaded: string[];
  path: string;
  target: StagingDbTarget;
} {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${path.basename(filePath)}. Create it with DATABASE_URL and DIRECT_URL for the Neon staging branch only.`
    );
  }

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

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing after loading staging env.");
  }
  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is missing after loading staging env (required for Prisma Migrate).");
  }

  const databaseMeta = summarizeUrl(process.env.DATABASE_URL);
  const directMeta = summarizeUrl(process.env.DIRECT_URL);
  if (databaseMeta.isSqlite || directMeta.isSqlite) {
    throw new Error(
      "Refusing staging env that points at SQLite/file database. Use Neon PostgreSQL staging URLs only."
    );
  }
  if (!databaseMeta.isPooler) {
    throw new Error(
      "DATABASE_URL should be the Neon pooled endpoint (-pooler) for the Next.js app runtime."
    );
  }
  if (directMeta.isPooler) {
    throw new Error(
      "DIRECT_URL should be the Neon direct (non-pooler) endpoint for Prisma Migrate / transfer."
    );
  }
  if (
    databaseMeta.endpointId &&
    directMeta.endpointId &&
    databaseMeta.endpointId !== directMeta.endpointId
  ) {
    throw new Error(
      "DATABASE_URL and DIRECT_URL endpoint IDs differ — refusing to continue (possible mixed-branch config)."
    );
  }

  const dbEp = endpointIdFromUrl(process.env.DATABASE_URL);
  const directEp = endpointIdFromUrl(process.env.DIRECT_URL);
  if (dbEp === NEON_PRODUCTION_ENDPOINT_ID || directEp === NEON_PRODUCTION_ENDPOINT_ID) {
    throw new Error(
      `Refusing production endpoint ${NEON_PRODUCTION_ENDPOINT_ID} in staging loader. Use staging endpoint ${NEON_STAGING_ENDPOINT_ID} only.`
    );
  }
  if (
    (dbEp && dbEp !== NEON_STAGING_ENDPOINT_ID) ||
    (directEp && directEp !== NEON_STAGING_ENDPOINT_ID)
  ) {
    throw new Error(
      `Staging loader expected endpoint ${NEON_STAGING_ENDPOINT_ID}. Got DATABASE_URL=${dbEp ?? "unknown"}, DIRECT_URL=${directEp ?? "unknown"}.`
    );
  }

  // Hard safety: never accidentally run against a URL that looks like production branch
  // unless TRI_ALLOW_PRODUCTION_DB=1 (should remain unset).
  const urls = `${process.env.DATABASE_URL}\n${process.env.DIRECT_URL}`.toLowerCase();
  if (
    process.env.TRI_ALLOW_PRODUCTION_DB !== "1" &&
    (urls.includes("-prod") || urls.includes("/production") || urls.includes("branch=production"))
  ) {
    throw new Error(
      "Refusing to load env that appears to target a production database branch. Use Neon staging only."
    );
  }

  // Always force mock Odoo for staging-wrapped local ops.
  // Do not delete RESEND_API_KEY if the operator set it for invite/reset testing.
  process.env.ODOO_MODE = "mock";
  if (!process.env.TRI_LAUNCH_MODE) {
    process.env.TRI_LAUNCH_MODE = "full";
  }

  return { loaded, path: filePath, target: getStagingDbTarget() };
}

export function assertStagingOnly() {
  const { target } = loadStagingEnv();
  console.info(
    `[staging-env] Loaded .env.staging (values hidden). endpoint=${target.endpointId ?? "unknown"} db=${target.dbName ?? "unknown"} pooler=${target.databaseUrlIsPooler} ODOO_MODE=${process.env.ODOO_MODE}.`
  );
}
