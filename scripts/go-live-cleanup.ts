#!/usr/bin/env tsx
/**
 * One-off go-live clean-up on PRODUCTION: removes tester dealer accounts, every order of their companies,
 * and their message threads (src/lib/users/go-live-cleanup.ts). Companies and stations stay.
 *
 * Operator procedure (Adrian):
 * 1. Neon console: create a branch of production named `before-go-live-cleanup` (the backup).
 * 2. Dry run (changes nothing; prints what would go, incl. Odoo quotation numbers to cancel by hand):
 *      TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \
 *        npm run production:cleanup:testers -- rmwangi@trinityenergyltd.com jopiyo@trinityenergyltd.com dealer.admin@trinityenergyltd.com
 * 3. Read the output. Then the real run, same emails, plus the allow flag and --confirm:
 *      TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh TRI_ALLOW_PRODUCTION_CLEANUP=1 \
 *        npm run production:cleanup:testers -- --confirm rmwangi@... jopiyo@... dealer.admin@...
 * 4. Cancel the listed quotations in Odoo by hand; the script never touches Odoo.
 */
import { PrismaClient } from "@prisma/client";
import { loadProductionEnv } from "./load-production-env";
import { goLiveCleanup } from "../src/lib/users/go-live-cleanup";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const emails = args.filter((a) => !a.startsWith("--"));

async function main() {
  if (emails.length === 0) throw new Error("Usage: production:cleanup:testers -- [--confirm] <email> [<email> ...]");
  if (confirm && process.env.TRI_ALLOW_PRODUCTION_CLEANUP !== "1") {
    throw new Error("Refusing to delete. Set TRI_ALLOW_PRODUCTION_CLEANUP=1 for this command only, after reading the dry run.");
  }
  const { target } = loadProductionEnv(); // refuses unless TRI_CONFIRM_PRODUCTION_ENDPOINT matches production
  console.info(`[cleanup] mode=${confirm ? "DELETE" : "dry-run"} endpoint=${target.endpointId} db=${target.dbName ?? "unknown"}`);

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } } });
  try {
    const result = await goLiveCleanup(prisma, emails, { confirm, label: new Date().toISOString() });
    if (!result.ok) throw new Error(result.message);
    const { plan } = result;
    for (const u of plan.users) console.info(`[cleanup] user   ${u.name} <${u.email}> · ${u.company ?? "no company"}`);
    console.info(`[cleanup] companies kept (with their stations): ${plan.companies.join(", ") || "none"}`);
    console.info(`[cleanup] orders: ${plan.orders.length}`);
    for (const o of plan.orders) console.info(`[cleanup]   ${o.reference} ${o.status} by ${o.createdBy}${o.odooQuotationNumber ? ` · Odoo ${o.odooQuotationNumber}` : ""}`);
    console.info(`[cleanup] message threads: ${plan.conversations} (${plan.messages} messages, both sides)`);
    if (plan.otherUsersInCompanies.length) {
      console.warn(`[cleanup] NOTE: these users in the same companies stay, but their company's orders go: ${plan.otherUsersInCompanies.join(", ")}`);
    }
    const odoo = plan.orders.flatMap((o) => (o.odooQuotationNumber ? [o.odooQuotationNumber] : []));
    if (odoo.length) console.info(`[cleanup] cancel in Odoo by hand: ${odoo.join(", ")}`);
    console.info(result.deleted ? "[cleanup] DONE: deleted in one transaction and logged as GO_LIVE_CLEANUP." : "[cleanup] Dry run: nothing changed. Re-run with --confirm to delete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(`[cleanup] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
