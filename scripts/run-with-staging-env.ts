#!/usr/bin/env tsx
/**
 * Run a child process with .env.staging loaded into the environment.
 * Prisma does not load .env.staging automatically — always use this wrapper
 * for staging migrate / transfer / validate-against-DB operations.
 *
 * Examples:
 *   npx tsx scripts/run-with-staging-env.ts npx prisma migrate status
 *   npx tsx scripts/run-with-staging-env.ts npx prisma migrate deploy
 *   npx tsx scripts/run-with-staging-env.ts npx tsx scripts/transfer-sqlite-to-postgres.ts
 *
 * Does NOT print secret values.
 */
import { spawnSync } from "node:child_process";
import { loadStagingEnv } from "./load-staging-env";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: tsx scripts/run-with-staging-env.ts <command> [args...]\n" +
      "Loads .env.staging (DATABASE_URL + DIRECT_URL), forces ODOO_MODE=mock, then runs the command."
  );
  process.exit(1);
}

const { loaded, target } = loadStagingEnv();
console.info(
  `[run-with-staging-env] Loaded ${loaded.length} keys from .env.staging (values hidden). ` +
    `endpoint=${target.endpointId ?? "unknown"} db=${target.dbName ?? "unknown"} ` +
    `pooler=${target.databaseUrlIsPooler} ODOO_MODE=${process.env.ODOO_MODE ?? "unset"}`
);
console.info(
  "[run-with-staging-env] Confirm in Neon console that this endpoint is the staging branch before app use."
);

const [cmd, ...cmdArgs] = args;
const result = spawnSync(cmd, cmdArgs, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
