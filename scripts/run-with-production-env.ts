#!/usr/bin/env tsx
/**
 * Run a command with Neon production credentials from `.env.production.local`.
 * Never loads `.env.staging`. Rejects the staging endpoint.
 *
 * Examples (schema ops only — no data transfer/seed):
 *   npx tsx scripts/run-with-production-env.ts npx tsx scripts/preflight-production-migrate.ts
 *   TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \\
 *     npx tsx scripts/run-with-production-env.ts npx prisma migrate status
 *
 * Deploy (after approval + preflight):
 *   TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \\
 *   TRI_ALLOW_PRODUCTION_MIGRATE=1 \\
 *     npx tsx scripts/run-with-production-env.ts npx prisma migrate deploy
 *
 * Does NOT print secret values.
 */
import { spawnSync } from "node:child_process";
import {
  assertProductionMigrateAllowed,
  loadProductionEnv,
} from "./load-production-env";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: tsx scripts/run-with-production-env.ts <command> [args...]\n" +
      "Requires .env.production.local + TRI_CONFIRM_PRODUCTION_ENDPOINT=<production-endpoint-id>."
  );
  process.exit(1);
}

const { loaded, target } = loadProductionEnv();
console.info(
  `[run-with-production-env] Loaded ${loaded.length} keys from ${target.envFile} (values hidden). ` +
    `endpoint=${target.endpointId} db=${target.dbName ?? "unknown"} pooler=${target.databaseUrlIsPooler} ODOO_MODE=${process.env.ODOO_MODE}`
);

const cmdLine = args.join(" ");
const isMigrateDeploy =
  /\bprisma\b/.test(cmdLine) && /\bmigrate\b/.test(cmdLine) && /\bdeploy\b/.test(cmdLine);
const isBootstrap = /bootstrap-production-admin/.test(cmdLine);
const isForbidden =
  /\bdb\s+push\b/.test(cmdLine) ||
  /\bmigrate\s+dev\b/.test(cmdLine) ||
  /\bmigrate\s+reset\b/.test(cmdLine) ||
  /\bdb:seed\b/.test(cmdLine) ||
  /prisma\/seed/.test(cmdLine) ||
  /transfer-sqlite-to-postgres/.test(cmdLine) ||
  /staging:transfer/.test(cmdLine);

if (isBootstrap && process.env.TRI_ALLOW_PRODUCTION_BOOTSTRAP !== "1") {
  console.error(
    "[run-with-production-env] Refusing bootstrap without TRI_ALLOW_PRODUCTION_BOOTSTRAP=1."
  );
  process.exit(1);
}

if (isForbidden) {
  console.error(
    "[run-with-production-env] Refusing forbidden command (db push / migrate dev|reset / seed / data transfer)."
  );
  process.exit(1);
}

if (isMigrateDeploy) {
  assertProductionMigrateAllowed();
  console.info(
    "[run-with-production-env] TRI_ALLOW_PRODUCTION_MIGRATE=1 acknowledged — running migrate deploy against production endpoint only."
  );
}

const [cmd, ...cmdArgs] = args;
const result = spawnSync(cmd, cmdArgs, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
