#!/usr/bin/env tsx
/**
 * One-shot production SUPER_ADMIN bootstrap.
 *
 * Creates exactly one ACTIVE / INTERNAL / SUPER_ADMIN when the User table is empty.
 * Never runs prisma/seed.ts. Never creates dealers/demos/orders.
 *
 * Operator procedure (DO NOT run until approved):
 *
 * 1. Confirm Neon endpoint ep-quiet-wildflower-zaag2pmh in the console.
 * 2. Ensure `.env.production.local` has production DATABASE_URL + DIRECT_URL only.
 * 3. Prefer a password file (avoids shell history), then dry-run:
 *      umask 077
 *      printf '%s' 'your-strong-password' > /tmp/tri-bootstrap-pw
 *      TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \
 *      TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 \
 *      BOOTSTRAP_ADMIN_EMAIL='admin@yourdomain.com' \
 *      BOOTSTRAP_ADMIN_PASSWORD_FILE=/tmp/tri-bootstrap-pw \
 *        npm run production:bootstrap:admin -- --dry-run
 *      shred -u /tmp/tri-bootstrap-pw 2>/dev/null || rm -f /tmp/tri-bootstrap-pw
 * 4. After approval, omit --dry-run to create the account (password never logged).
 * 5. Log in at /intelligence/login and change the password immediately.
 *
 * Requires TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 and TRI_CONFIRM_PRODUCTION_ENDPOINT.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { loadProductionEnv } from "./load-production-env";
import { NEON_PRODUCTION_ENDPOINT_ID } from "./neon-endpoints";
import { validatePasswordStrength } from "../src/lib/security/password-policy";

/** Stable lock id for TRI production admin bootstrap (transaction-scoped). */
export const TRI_BOOTSTRAP_ADVISORY_LOCK_KEY = 872_014_001;

function directUrlWithTimeout(raw: string): string {
  const u = new URL(raw);
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
  return u.toString();
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run") || argv.includes("--preflight"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function requireBootstrapAuth() {
  if (process.env.TRI_ALLOW_PRODUCTION_BOOTSTRAP !== "1") {
    throw new Error(
      "Refusing bootstrap. Set TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 for this command only after preflight."
    );
  }
}

async function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode?.(true);

    process.stdout.write(question);
    let value = "";
    const onData = (buf: Buffer) => {
      const s = buf.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          stdin.off("data", onData);
          if (stdin.isTTY) stdin.setRawMode?.(wasRaw ?? false);
          process.stdout.write("\n");
          rl.close();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function resolvePassword(): Promise<string> {
  const filePath = process.env.BOOTSTRAP_ADMIN_PASSWORD_FILE?.trim();
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`BOOTSTRAP_ADMIN_PASSWORD_FILE not found: ${path.basename(resolved)}`);
    }
    const password = fs.readFileSync(resolved, "utf8").replace(/\r?\n$/, "");
    if (!password) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD_FILE is empty.");
    }
    return password;
  }

  const fromEnv = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (fromEnv) {
    console.warn(
      "[bootstrap-admin] Using BOOTSTRAP_ADMIN_PASSWORD from the environment. Prefer BOOTSTRAP_ADMIN_PASSWORD_FILE or interactive prompt to avoid shell history exposure."
    );
    return fromEnv;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      "No password provided. Set BOOTSTRAP_ADMIN_PASSWORD_FILE (preferred) or BOOTSTRAP_ADMIN_PASSWORD, or run in a TTY for interactive entry."
    );
  }

  const once = await promptHidden("Bootstrap admin password (hidden): ");
  const twice = await promptHidden("Confirm password (hidden): ");
  if (once !== twice) {
    throw new Error("Passwords do not match.");
  }
  return once;
}

async function readAdminInputs() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const firstName = (process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "Super").trim() || "Super";
  const lastName = (process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "Admin").trim() || "Admin";

  if (!email || !email.includes("@")) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required (explicit administrator email).");
  }

  const password = await resolvePassword();
  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    throw new Error(strength.message);
  }

  return { email, password, firstName, lastName };
}

type BootstrapTx = {
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
  user: {
    count: (args?: unknown) => Promise<number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<unknown>;
  };
};

/**
 * Create the sole SUPER_ADMIN under a transaction-scoped advisory lock.
 * Exported for local unit tests (with a mocked tx).
 */
export async function createSoleSuperAdmin(
  tx: BootstrapTx,
  admin: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }
) {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${TRI_BOOTSTRAP_ADVISORY_LOCK_KEY})`
  );

  const existing = await tx.user.count();
  if (existing > 0) {
    throw new Error(
      `Refusing bootstrap: User table already has ${existing} row(s). Production admin must not be re-seeded.`
    );
  }

  await tx.user.create({
    data: {
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      passwordHash: admin.passwordHash,
      department: "Executive",
      role: "SUPER_ADMIN",
      accountType: "INTERNAL",
      status: "ACTIVE",
      permissions: JSON.stringify([
        "users",
        "reports",
        "note-taker",
        "presentations",
        "settings",
        "activity",
      ]),
    },
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.info(`Usage:
  TRI_CONFIRM_PRODUCTION_ENDPOINT=${NEON_PRODUCTION_ENDPOINT_ID} \\
  TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 \\
  BOOTSTRAP_ADMIN_EMAIL=... \\
  BOOTSTRAP_ADMIN_PASSWORD_FILE=/path/to/pw \\
    npm run production:bootstrap:admin -- [--dry-run]

Never logs passwords. Refuses if any User row already exists.
Uses pg_advisory_xact_lock(${TRI_BOOTSTRAP_ADVISORY_LOCK_KEY}) during create.`);
    return;
  }

  requireBootstrapAuth();
  const { target } = loadProductionEnv();
  const admin = await readAdminInputs();

  console.info(
    `[bootstrap-admin] mode=${flags.dryRun ? "dry-run" : "write"} endpoint=${target.endpointId} env=${target.envFile} email=${admin.email}`
  );
  console.info(
    "[bootstrap-admin] Password validated against policy (value not printed). Will create INTERNAL SUPER_ADMIN only."
  );

  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL missing after production env load.");
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrlWithTimeout(process.env.DIRECT_URL) } },
  });

  try {
    await prisma.$connect();

    const existingCount = await prisma.user.count();
    if (existingCount > 0) {
      throw new Error(
        `Refusing bootstrap: User table already has ${existingCount} row(s). Production admin must not be re-seeded.`
      );
    }

    if (flags.dryRun) {
      console.info(
        "[bootstrap-admin] Dry-run PASS — would create one SUPER_ADMIN under advisory lock; no writes performed."
      );
      return;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    await prisma.$transaction(async (tx) => {
      await createSoleSuperAdmin(tx as unknown as BootstrapTx, {
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
      });
    });

    console.info(
      `[bootstrap-admin] Created SUPER_ADMIN for ${admin.email}. Password not logged. Change it after first login.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

const entry = process.argv[1] ?? "";
const isDirectRun =
  /bootstrap-production-admin\.(ts|js|mjs|cjs)$/.test(entry) &&
  !entry.includes(".test.");
if (isDirectRun) {
  main().catch((err) => {
    console.error(
      "[bootstrap-admin] FAILED:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  });
}
