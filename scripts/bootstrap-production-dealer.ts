#!/usr/bin/env tsx
/**
 * Production DEALER portal bootstrap (ACTIVE DEALER_ADMIN).
 *
 * Staff SUPER_ADMIN cannot sign in at /dealer/login — dealer portal requires
 * accountType=DEALER. This script upserts one dealer org + station + admin user.
 *
 * Usage:
 *   TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \
 *   TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 \
 *   BOOTSTRAP_DEALER_EMAIL='dealer.admin@trinityenergyltd.com' \
 *   BOOTSTRAP_DEALER_PASSWORD_FILE=/tmp/tri-dealer-pw \
 *   BOOTSTRAP_DEALER_STATION=kitanga \
 *     npm run production:bootstrap:dealer -- --dry-run
 *
 * Omit --dry-run to write. Password is never logged.
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { loadProductionEnv } from "./load-production-env";
import { NEON_PRODUCTION_ENDPOINT_ID } from "./neon-endpoints";
import { validatePasswordStrength } from "../src/lib/security/password-policy";
import { getStationInviteRow } from "../src/lib/dealers/station-invite-catalog";

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
      "Refusing bootstrap. Set TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 for this command only after approval."
    );
  }
}

function resolvePassword(): string {
  const filePath = process.env.BOOTSTRAP_DEALER_PASSWORD_FILE?.trim();
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`BOOTSTRAP_DEALER_PASSWORD_FILE not found: ${path.basename(resolved)}`);
    }
    const password = fs.readFileSync(resolved, "utf8").replace(/\r?\n$/, "");
    if (!password) throw new Error("BOOTSTRAP_DEALER_PASSWORD_FILE is empty.");
    return password;
  }
  const fromEnv = process.env.BOOTSTRAP_DEALER_PASSWORD ?? "";
  if (fromEnv) {
    console.warn(
      "[bootstrap-dealer] Using BOOTSTRAP_DEALER_PASSWORD from the environment. Prefer BOOTSTRAP_DEALER_PASSWORD_FILE."
    );
    return fromEnv;
  }
  throw new Error(
    "No password provided. Set BOOTSTRAP_DEALER_PASSWORD_FILE (preferred) or BOOTSTRAP_DEALER_PASSWORD."
  );
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.info(`Usage:
  TRI_CONFIRM_PRODUCTION_ENDPOINT=${NEON_PRODUCTION_ENDPOINT_ID} \\
  TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 \\
  BOOTSTRAP_DEALER_EMAIL=... \\
  BOOTSTRAP_DEALER_PASSWORD_FILE=/path/to/pw \\
  BOOTSTRAP_DEALER_STATION=kitanga \\
    npm run production:bootstrap:dealer -- [--dry-run]`);
    return;
  }

  requireBootstrapAuth();
  const { target } = loadProductionEnv();

  const email = (process.env.BOOTSTRAP_DEALER_EMAIL ?? "").trim().toLowerCase();
  const firstName = (process.env.BOOTSTRAP_DEALER_FIRST_NAME ?? "Dealer").trim() || "Dealer";
  const lastName = (process.env.BOOTSTRAP_DEALER_LAST_NAME ?? "Admin").trim() || "Admin";
  const stationCode = (process.env.BOOTSTRAP_DEALER_STATION ?? "kitanga").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("BOOTSTRAP_DEALER_EMAIL is required.");
  }

  const catalog = getStationInviteRow(stationCode);
  if (!catalog) throw new Error(`Unknown station code: ${stationCode}`);
  if (!catalog.invitable) {
    throw new Error(
      `Station "${catalog.stationName}" is not invitable (missing partner/station External IDs).`
    );
  }

  const password = resolvePassword();
  const strength = validatePasswordStrength(password);
  if (!strength.ok) throw new Error(strength.message);

  console.info(
    `[bootstrap-dealer] mode=${flags.dryRun ? "dry-run" : "write"} endpoint=${target.endpointId} env=${target.envFile}`
  );
  console.info(
    `[bootstrap-dealer] email=${email} station=${catalog.stationName} (${catalog.stationCode}) org=${catalog.orgCode} tradingName=${catalog.tradingName}`
  );
  console.info("[bootstrap-dealer] Password validated (value not printed).");

  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL missing after production env load.");
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrlWithTimeout(process.env.DIRECT_URL) } },
  });

  try {
    await prisma.$connect();

    if (flags.dryRun) {
      const existing = await prisma.user.findUnique({ where: { email } });
      console.info(
        `[bootstrap-dealer] Dry-run PASS — would ${existing ? "update password/status for" : "create"} DEALER_ADMIN; upsert org+station. No writes.`
      );
      return;
    }

    const productsJson = JSON.stringify(catalog.products);
    const passwordHash = await bcrypt.hash(password, 12);

    const org = await prisma.dealerOrganization.upsert({
      where: { code: catalog.orgCode },
      create: {
        code: catalog.orgCode,
        name: catalog.orgName,
        odooPartnerId: catalog.odooPartnerId,
        odooPartnerExternalId: catalog.odooPartnerExternalId,
        products: productsJson,
      },
      update: {
        name: catalog.orgName,
        odooPartnerId: catalog.odooPartnerId ?? undefined,
        odooPartnerExternalId: catalog.odooPartnerExternalId ?? undefined,
        products: productsJson,
      },
    });

    await prisma.station.upsert({
      where: { code: catalog.stationCode },
      create: {
        code: catalog.stationCode,
        name: catalog.stationName,
        tradingName: catalog.tradingName,
        dealerOrganizationId: org.id,
        odooPartnerId: catalog.odooPartnerId,
        odooPartnerExternalId: catalog.odooPartnerExternalId,
        odooStationExternalId: catalog.odooStationExternalId,
        products: productsJson,
      },
      update: {
        name: catalog.stationName,
        tradingName: catalog.tradingName,
        dealerOrganizationId: org.id,
        odooPartnerId: catalog.odooPartnerId ?? undefined,
        odooPartnerExternalId: catalog.odooPartnerExternalId ?? undefined,
        odooStationExternalId: catalog.odooStationExternalId ?? undefined,
        products: productsJson,
      },
    });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.accountType !== "DEALER") {
        throw new Error(
          `User ${email} exists as ${existing.accountType}/${existing.role}. Refusing to overwrite a non-dealer account.`
        );
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: "ACTIVE",
          firstName,
          lastName,
          role: "DEALER_ADMIN",
          dealerOrganizationId: org.id,
          department: "Dealer",
        },
      });
      console.info(
        `[bootstrap-dealer] Updated existing DEALER_ADMIN ${email} (password reset, ACTIVE). Change password after login.`
      );
    } else {
      await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
          department: "Dealer",
          role: "DEALER_ADMIN",
          accountType: "DEALER",
          status: "ACTIVE",
          dealerOrganizationId: org.id,
          permissions: "[]",
        },
      });
      console.info(
        `[bootstrap-dealer] Created DEALER_ADMIN ${email}. Password not logged. Login at /dealer/login.`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[bootstrap-dealer] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
