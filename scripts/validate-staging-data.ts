#!/usr/bin/env tsx
/**
 * Read-only validation of Neon staging data after SQLite→Postgres transfer.
 * Does not modify any records. Does not print credentials or password hashes.
 *
 * Usage:
 *   npx tsx scripts/run-with-staging-env.ts npx tsx scripts/validate-staging-data.ts
 *   npm run staging:validate
 */
import { PrismaClient } from "@prisma/client";

function directUrlWithTimeout(raw: string): string {
  const u = new URL(raw);
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
  return u.toString();
}

const EXPECTED = {
  User: 23,
  DealerOrganization: 21,
  Station: 24,
  DealerOrder: 15,
  DealerOrderLine: 29,
  OrderStatusHistory: 30,
  ActivityLog: 113,
  Depot: 1,
} as const;

async function main() {
  if (!process.env.DIRECT_URL || !process.env.DATABASE_URL) {
    throw new Error("Run via staging env wrapper so DATABASE_URL and DIRECT_URL are set.");
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrlWithTimeout(process.env.DIRECT_URL) } },
  });

  try {
    await prisma.$connect();

    const counts = {
      User: await prisma.user.count(),
      DealerOrganization: await prisma.dealerOrganization.count(),
      Station: await prisma.station.count(),
      DealerOrder: await prisma.dealerOrder.count(),
      DealerOrderLine: await prisma.dealerOrderLine.count(),
      OrderStatusHistory: await prisma.orderStatusHistory.count(),
      ActivityLog: await prisma.activityLog.count(),
      Depot: await prisma.depot.count(),
      NoteSession: await prisma.noteSession.count(),
      Presentation: await prisma.presentation.count(),
      OrderSequence: await prisma.orderSequence.count(),
      SystemSetting: await prisma.systemSetting.count(),
    };

    const countMismatches: string[] = [];
    for (const [k, expected] of Object.entries(EXPECTED)) {
      const actual = counts[k as keyof typeof counts];
      if (actual !== expected) countMismatches.push(`${k}: expected ${expected}, got ${actual}`);
    }

    const orphans = await prisma.$queryRawUnsafe<
      Array<{ check: string; n: number }>
    >(`
      SELECT 'users_missing_org' AS check, COUNT(*)::int AS n
      FROM "User" u
      WHERE u."dealerOrganizationId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "DealerOrganization" o WHERE o.id = u."dealerOrganizationId")
      UNION ALL
      SELECT 'users_missing_depot', COUNT(*)::int
      FROM "User" u
      WHERE u."depotId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Depot" d WHERE d.id = u."depotId")
      UNION ALL
      SELECT 'stations_missing_org', COUNT(*)::int
      FROM "Station" s
      WHERE NOT EXISTS (SELECT 1 FROM "DealerOrganization" o WHERE o.id = s."dealerOrganizationId")
      UNION ALL
      SELECT 'orders_missing_org', COUNT(*)::int
      FROM "DealerOrder" o
      WHERE NOT EXISTS (SELECT 1 FROM "DealerOrganization" d WHERE d.id = o."dealerOrganizationId")
      UNION ALL
      SELECT 'orders_missing_station', COUNT(*)::int
      FROM "DealerOrder" o
      WHERE NOT EXISTS (SELECT 1 FROM "Station" s WHERE s.id = o."stationId")
      UNION ALL
      SELECT 'orders_missing_creator', COUNT(*)::int
      FROM "DealerOrder" o
      WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = o."createdById")
      UNION ALL
      SELECT 'lines_missing_order', COUNT(*)::int
      FROM "DealerOrderLine" l
      WHERE NOT EXISTS (SELECT 1 FROM "DealerOrder" o WHERE o.id = l."orderId")
      UNION ALL
      SELECT 'history_missing_order', COUNT(*)::int
      FROM "OrderStatusHistory" h
      WHERE NOT EXISTS (SELECT 1 FROM "DealerOrder" o WHERE o.id = h."orderId")
      UNION ALL
      SELECT 'history_missing_actor', COUNT(*)::int
      FROM "OrderStatusHistory" h
      WHERE h."actorId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = h."actorId")
      UNION ALL
      SELECT 'activity_missing_actor', COUNT(*)::int
      FROM "ActivityLog" a
      WHERE a."actorId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."actorId")
    `);

    const orphanProblems = orphans.filter((r) => r.n > 0);

    const userIntegrity = await prisma.$queryRawUnsafe<
      Array<{
        total: number;
        with_hash: number;
        dealer_with_org: number;
        depot_with_depot: number;
        by_account: string;
      }>
    >(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "passwordHash" IS NOT NULL AND length("passwordHash") > 20)::int AS with_hash,
        COUNT(*) FILTER (WHERE "accountType" = 'DEALER' AND "dealerOrganizationId" IS NOT NULL)::int AS dealer_with_org,
        COUNT(*) FILTER (WHERE "accountType" = 'DEPOT' AND "depotId" IS NOT NULL)::int AS depot_with_depot,
        string_agg(DISTINCT "accountType" || ':' || "role", ', ' ORDER BY "accountType" || ':' || "role") AS by_account
      FROM "User"
    `);

    const roleCounts = await prisma.user.groupBy({
      by: ["accountType", "role", "status"],
      _count: { _all: true },
      orderBy: [{ accountType: "asc" }, { role: "asc" }],
    });

    console.info("[validate-staging] Table counts:");
    for (const [k, v] of Object.entries(counts)) {
      const exp = EXPECTED[k as keyof typeof EXPECTED];
      const mark = exp === undefined ? " " : v === exp ? "✓" : "✗";
      console.info(`  ${mark} ${k}: ${v}${exp !== undefined ? ` (expected ${exp})` : ""}`);
    }

    console.info("[validate-staging] FK orphan checks:");
    for (const row of orphans) {
      console.info(`  ${row.n === 0 ? "✓" : "✗"} ${row.check}: ${row.n}`);
    }

    const ui = userIntegrity[0];
    console.info("[validate-staging] User integrity (no hashes printed):");
    console.info(`  total=${ui.total} withPasswordHash=${ui.with_hash}`);
    console.info(`  dealerUsersWithOrg=${ui.dealer_with_org} depotUsersWithDepot=${ui.depot_with_depot}`);
    console.info("  role matrix:");
    for (const r of roleCounts) {
      console.info(
        `    ${r.accountType}/${r.role}/${r.status}: ${r._count._all}`
      );
    }

    const ok =
      countMismatches.length === 0 &&
      orphanProblems.length === 0 &&
      ui.with_hash === ui.total &&
      ui.total === EXPECTED.User;

    if (!ok) {
      if (countMismatches.length) {
        console.error("[validate-staging] Count mismatches:", countMismatches.join("; "));
      }
      if (orphanProblems.length) {
        console.error(
          "[validate-staging] Orphan FKs:",
          orphanProblems.map((r) => `${r.check}=${r.n}`).join("; ")
        );
      }
      if (ui.with_hash !== ui.total) {
        console.error(
          `[validate-staging] Missing password hashes: ${ui.total - ui.with_hash} users`
        );
      }
      process.exitCode = 1;
      return;
    }

    console.info("[validate-staging] PASS — counts, FKs, and password-hash presence look good.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[validate-staging] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
