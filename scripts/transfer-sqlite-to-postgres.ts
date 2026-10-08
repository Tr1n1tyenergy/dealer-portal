#!/usr/bin/env tsx
/**
 * SQLite → PostgreSQL data transfer for Trinity Retail Intelligence.
 *
 * Safety defaults:
 * - Source DB is READ-ONLY (never modified).
 * - Default source: backups/tri-before-postgres.db
 * - Skips expired InvitationToken / PasswordResetToken rows.
 * - With --exclude-demo (recommended before any public/prod-like target):
 *   skips seed-* IDs and *.example emails and cascading dependents.
 * - Requires empty Postgres tables (or --force to wipe target tables — staging only).
 * - Does NOT run schema migrations; schema must already be applied via migrate deploy.
 * - Does NOT print credentials or password hashes.
 *
 * Usage:
 *   # Dry-run against backup (no Postgres connection):
 *   npx tsx scripts/transfer-sqlite-to-postgres.ts --dry-run --exclude-demo
 *
 *   # Apply to Neon staging (after migrate deploy), via staging env wrapper:
 *   npx tsx scripts/run-with-staging-env.ts npx tsx scripts/transfer-sqlite-to-postgres.ts --exclude-demo
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const DEFAULT_SOURCE = path.resolve(process.cwd(), "backups/tri-before-postgres.db");

type Flags = {
  dryRun: boolean;
  excludeDemo: boolean;
  force: boolean;
  source: string;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    dryRun: false,
    excludeDemo: false,
    force: false,
    source: DEFAULT_SOURCE,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--exclude-demo") flags.excludeDemo = true;
    else if (a === "--force") flags.force = true;
    else if (a === "--source" && argv[i + 1]) {
      flags.source = path.resolve(process.cwd(), argv[++i]);
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: transfer-sqlite-to-postgres.ts [--dry-run] [--exclude-demo] [--force] [--source path]
  --dry-run         Count/filter only; do not connect to Postgres
  --exclude-demo    Skip seed-* IDs and *.example emails (and dependents)
  --force           Delete existing Postgres rows before import (staging only)
  --source <path>   SQLite file (default: backups/tri-before-postgres.db)`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return flags;
}

function isDemoId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith("seed-"));
}

function isDemoEmail(email: string): boolean {
  return /\.example$/i.test(email) || /@example\./i.test(email);
}

function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  // Prisma's SQLite connector stores DateTime as integer epoch milliseconds;
  // new Date("1791370225439") is Invalid Date, so numbers must not be stringified.
  const d =
    typeof value === "number" || typeof value === "bigint" || /^\d+$/.test(String(value))
      ? new Date(Number(value))
      : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function requireDate(value: unknown, fallback = new Date()): Date {
  return toDate(value) ?? fallback;
}

/**
 * Neon idle computes can exceed Prisma's default ~5s connect timeout (P1001).
 * Keep DIRECT_URL for bulk writes; only raise timeouts if not already set.
 */
function directUrlForPrismaClient(rawUrl: string): string {
  const u = new URL(rawUrl);
  if (!u.searchParams.has("connect_timeout")) {
    u.searchParams.set("connect_timeout", "30");
  }
  if (!u.searchParams.has("pool_timeout")) {
    u.searchParams.set("pool_timeout", "30");
  }
  return u.toString();
}

type Row = Record<string, unknown>;

function allRows(db: DatabaseSync, table: string): Row[] {
  return db.prepare(`SELECT * FROM "${table}"`).all() as Row[];
}

function integrityOk(db: DatabaseSync): boolean {
  const row = db.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
  return row?.integrity_check === "ok";
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (!fs.existsSync(flags.source)) {
    throw new Error(`SQLite source not found: ${flags.source}`);
  }

  // Open read-only when possible
  const db = new DatabaseSync(flags.source, { readOnly: true });
  if (!integrityOk(db)) {
    throw new Error("SQLite integrity_check failed — refusing to transfer.");
  }
  console.info(`[transfer] Source OK (integrity_check=ok): ${flags.source}`);
  console.info(
    `[transfer] mode=${flags.dryRun ? "dry-run" : "write"} excludeDemo=${flags.excludeDemo} force=${flags.force}`
  );

  const now = new Date();

  let depots = allRows(db, "Depot");
  let orgs = allRows(db, "DealerOrganization");
  let stations = allRows(db, "Station");
  let users = allRows(db, "User");
  let orderSeq = allRows(db, "OrderSequence");
  let settings = allRows(db, "SystemSetting");
  let invitations = allRows(db, "InvitationToken");
  let resets = allRows(db, "PasswordResetToken");
  let noteSessions = allRows(db, "NoteSession");
  let presentations = allRows(db, "Presentation");
  let reports = allRows(db, "Report");
  let orders = allRows(db, "DealerOrder");
  let lines = allRows(db, "DealerOrderLine");
  let proformas = allRows(db, "ProFormaInvoice");
  let payments = allRows(db, "PaymentRecord");
  let history = allRows(db, "OrderStatusHistory");
  let documents = allRows(db, "OrderDocument");
  let activity = allRows(db, "ActivityLog");

  const expiredInvitations = invitations.filter((r) => {
    const exp = toDate(r.expiresAt);
    return !exp || exp.getTime() < now.getTime();
  });
  const expiredResets = resets.filter((r) => {
    const exp = toDate(r.expiresAt);
    return !exp || exp.getTime() < now.getTime();
  });
  invitations = invitations.filter((r) => {
    const exp = toDate(r.expiresAt);
    return exp != null && exp.getTime() >= now.getTime();
  });
  resets = resets.filter((r) => {
    const exp = toDate(r.expiresAt);
    return exp != null && exp.getTime() >= now.getTime();
  });

  console.info(
    `[transfer] Skipped expired tokens: InvitationToken=${expiredInvitations.length}, PasswordResetToken=${expiredResets.length}`
  );

  if (flags.excludeDemo) {
    const skipUserIds = new Set(
      users
        .filter((u) => isDemoId(String(u.id)) || isDemoEmail(String(u.email)))
        .map((u) => String(u.id))
    );
    const skipOrgIds = new Set(
      orgs.filter((o) => isDemoId(String(o.id)) || String(o.code) === "ABC").map((o) => String(o.id))
    );
    // Also skip orgs that only exist for demo ABC dealers.example
    for (const u of users) {
      if (skipUserIds.has(String(u.id)) && u.dealerOrganizationId) {
        // keep official dealers; only mark org skip if org itself is seed/demo
      }
    }
    const skipStationIds = new Set(
      stations
        .filter(
          (s) =>
            isDemoId(String(s.id)) ||
            isDemoId(String(s.code)) ||
            skipOrgIds.has(String(s.dealerOrganizationId))
        )
        .map((s) => String(s.id))
    );
    const skipOrderIds = new Set(
      orders
        .filter(
          (o) =>
            isDemoId(String(o.id)) ||
            skipStationIds.has(String(o.stationId)) ||
            skipOrgIds.has(String(o.dealerOrganizationId)) ||
            skipUserIds.has(String(o.createdById))
        )
        .map((o) => String(o.id))
    );
    const skipSessionIds = new Set(
      noteSessions
        .filter((s) => isDemoId(String(s.id)) || skipUserIds.has(String(s.userId)))
        .map((s) => String(s.id))
    );

    users = users.filter((u) => !skipUserIds.has(String(u.id)));
    orgs = orgs.filter((o) => !skipOrgIds.has(String(o.id)));
    stations = stations.filter((s) => !skipStationIds.has(String(s.id)));
    orders = orders.filter((o) => !skipOrderIds.has(String(o.id)));
    lines = lines.filter((l) => !skipOrderIds.has(String(l.orderId)));
    proformas = proformas.filter((p) => !skipOrderIds.has(String(p.orderId)));
    payments = payments.filter((p) => !skipOrderIds.has(String(p.orderId)));
    history = history.filter((h) => !skipOrderIds.has(String(h.orderId)));
    documents = documents.filter((d) => !skipOrderIds.has(String(d.orderId)));
    noteSessions = noteSessions.filter((s) => !skipSessionIds.has(String(s.id)));
    presentations = presentations.filter(
      (p) =>
        !isDemoId(String(p.id)) &&
        !skipUserIds.has(String(p.userId)) &&
        !(p.noteSessionId && skipSessionIds.has(String(p.noteSessionId)))
    );
    reports = reports.filter(
      (r) => !isDemoId(String(r.id)) && !skipUserIds.has(String(r.userId))
    );
    invitations = invitations.filter((t) => !skipUserIds.has(String(t.userId)));
    resets = resets.filter((t) => !skipUserIds.has(String(t.userId)));
    activity = activity.filter(
      (a) => !(a.actorId && skipUserIds.has(String(a.actorId))) && !isDemoId(String(a.id))
    );

    console.info(
      `[transfer] Demo exclusion applied: users=${skipUserIds.size} orgs=${skipOrgIds.size} stations=${skipStationIds.size} orders=${skipOrderIds.size}`
    );
  }

  const plan = {
    Depot: depots.length,
    DealerOrganization: orgs.length,
    Station: stations.length,
    User: users.length,
    OrderSequence: orderSeq.length,
    SystemSetting: settings.length,
    InvitationToken: invitations.length,
    PasswordResetToken: resets.length,
    NoteSession: noteSessions.length,
    Presentation: presentations.length,
    Report: reports.length,
    DealerOrder: orders.length,
    DealerOrderLine: lines.length,
    ProFormaInvoice: proformas.length,
    PaymentRecord: payments.length,
    OrderStatusHistory: history.length,
    OrderDocument: documents.length,
    ActivityLog: activity.length,
  };
  console.info("[transfer] Import plan (row counts):");
  for (const [k, v] of Object.entries(plan)) {
    console.info(`  ${k}: ${v}`);
  }

  if (flags.dryRun) {
    console.info("[transfer] Dry-run complete — no Postgres writes.");
    db.close();
    return;
  }

  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error(
      "DATABASE_URL and DIRECT_URL required. Use: npx tsx scripts/run-with-staging-env.ts npx tsx scripts/transfer-sqlite-to-postgres.ts ..."
    );
  }

  // Prefer direct URL for bulk inserts (avoid pooler prepared-statement quirks).
  // Raise connect timeouts and connect once before counts to survive Neon cold starts.
  const prisma = new PrismaClient({
    datasources: { db: { url: directUrlForPrismaClient(process.env.DIRECT_URL) } },
  });

  try {
    await prisma.$connect();
    // Sequential counts avoid opening multiple cold connections in parallel (P1001).
    const counts = [
      await prisma.user.count(),
      await prisma.dealerOrganization.count(),
      await prisma.dealerOrder.count(),
      await prisma.depot.count(),
    ];
    const existing = counts.reduce((a, b) => a + b, 0);
    if (existing > 0 && !flags.force) {
      throw new Error(
        `Target Postgres is not empty (sample counts sum=${existing}). Re-run with --force only on staging after explicit approval, or truncate manually.`
      );
    }

    if (existing > 0 && flags.force) {
      console.warn("[transfer] --force: clearing target tables (FK-safe order)...");
      // Child → parent
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE
        "ActivityLog",
        "OrderDocument",
        "OrderStatusHistory",
        "PaymentRecord",
        "ProFormaInvoice",
        "DealerOrderLine",
        "DealerOrder",
        "Presentation",
        "NoteSession",
        "Report",
        "InvitationToken",
        "PasswordResetToken",
        "User",
        "Station",
        "DealerOrganization",
        "Depot",
        "OrderSequence",
        "SystemSetting"
        RESTART IDENTITY CASCADE`);
    }

    await prisma.$transaction(
      async (tx) => {
        if (depots.length) {
          await tx.depot.createMany({
            data: depots.map((r) => ({
              id: String(r.id),
              name: String(r.name),
              code: String(r.code),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (orgs.length) {
          await tx.dealerOrganization.createMany({
            data: orgs.map((r) => ({
              id: String(r.id),
              name: String(r.name),
              code: String(r.code),
              odooPartnerId: r.odooPartnerId == null ? null : Number(r.odooPartnerId),
              products: String(r.products ?? '["PMS","AGO","LUBRICANTS","LPG"]'),
              createdAt: requireDate(r.createdAt),
              updatedAt: requireDate(r.updatedAt),
            })),
          });
        }

        if (stations.length) {
          await tx.station.createMany({
            data: stations.map((r) => ({
              id: String(r.id),
              code: r.code == null ? null : String(r.code),
              name: String(r.name),
              dealerOrganizationId: String(r.dealerOrganizationId),
              odooPartnerId: r.odooPartnerId == null ? null : Number(r.odooPartnerId),
              products: String(r.products ?? '["PMS","AGO","LUBRICANTS","LPG"]'),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (users.length) {
          await tx.user.createMany({
            data: users.map((r) => ({
              id: String(r.id),
              firstName: String(r.firstName),
              lastName: String(r.lastName),
              email: String(r.email),
              passwordHash: r.passwordHash == null ? null : String(r.passwordHash),
              department: String(r.department),
              role: r.role as never,
              accountType: r.accountType as never,
              status: r.status as never,
              permissions: String(r.permissions ?? "[]"),
              dealerOrganizationId:
                r.dealerOrganizationId == null ? null : String(r.dealerOrganizationId),
              depotId: r.depotId == null ? null : String(r.depotId),
              createdAt: requireDate(r.createdAt),
              updatedAt: requireDate(r.updatedAt),
              lastLoginAt: toDate(r.lastLoginAt),
            })),
          });
        }

        if (orderSeq.length) {
          await tx.orderSequence.createMany({
            data: orderSeq.map((r) => ({
              year: Number(r.year),
              lastNumber: Number(r.lastNumber ?? 0),
            })),
          });
        }

        if (settings.length) {
          await tx.systemSetting.createMany({
            data: settings.map((r) => ({
              id: String(r.id),
              key: String(r.key),
              value: String(r.value),
              updatedAt: requireDate(r.updatedAt),
            })),
          });
        }

        if (invitations.length) {
          await tx.invitationToken.createMany({
            data: invitations.map((r) => ({
              id: String(r.id),
              token: String(r.token),
              userId: String(r.userId),
              expiresAt: requireDate(r.expiresAt),
              usedAt: toDate(r.usedAt),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (resets.length) {
          await tx.passwordResetToken.createMany({
            data: resets.map((r) => ({
              id: String(r.id),
              token: String(r.token),
              userId: String(r.userId),
              expiresAt: requireDate(r.expiresAt),
              usedAt: toDate(r.usedAt),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (noteSessions.length) {
          await tx.noteSession.createMany({
            data: noteSessions.map((r) => ({
              id: String(r.id),
              name: String(r.name),
              userId: String(r.userId),
              status: r.status as never,
              scheduledAt: toDate(r.scheduledAt),
              startedAt: toDate(r.startedAt),
              endedAt: toDate(r.endedAt),
              durationSeconds: r.durationSeconds == null ? null : Number(r.durationSeconds),
              timeLimitSeconds: r.timeLimitSeconds == null ? null : Number(r.timeLimitSeconds),
              participants: String(r.participants ?? "[]"),
              audioUrl: r.audioUrl == null ? null : String(r.audioUrl),
              transcript: r.transcript == null ? null : String(r.transcript),
              transcriptStatus: r.transcriptStatus as never,
              notesStatus: r.notesStatus as never,
              notesJson: r.notesJson == null ? null : String(r.notesJson),
              createdAt: requireDate(r.createdAt),
              updatedAt: requireDate(r.updatedAt),
            })),
          });
        }

        if (presentations.length) {
          await tx.presentation.createMany({
            data: presentations.map((r) => ({
              id: String(r.id),
              title: String(r.title),
              userId: String(r.userId),
              noteSessionId: r.noteSessionId == null ? null : String(r.noteSessionId),
              slidesJson: String(r.slidesJson),
              presenter: r.presenter == null ? null : String(r.presenter),
              createdAt: requireDate(r.createdAt),
              updatedAt: requireDate(r.updatedAt),
            })),
          });
        }

        if (reports.length) {
          await tx.report.createMany({
            data: reports.map((r) => ({
              id: String(r.id),
              title: String(r.title),
              category: r.category as never,
              description: r.description == null ? null : String(r.description),
              dateFrom: toDate(r.dateFrom),
              dateTo: toDate(r.dateTo),
              contentJson: r.contentJson == null ? null : String(r.contentJson),
              userId: String(r.userId),
              createdAt: requireDate(r.createdAt),
              updatedAt: requireDate(r.updatedAt),
            })),
          });
        }

        if (orders.length) {
          await tx.dealerOrder.createMany({
            data: orders.map((r) => ({
              id: String(r.id),
              reference: String(r.reference),
              dealerOrganizationId: String(r.dealerOrganizationId),
              stationId: String(r.stationId),
              depotId: r.depotId == null ? null : String(r.depotId),
              createdById: String(r.createdById),
              status: r.status as never,
              requestedDeliveryDate: toDate(r.requestedDeliveryDate),
              dealerReference: r.dealerReference == null ? null : String(r.dealerReference),
              notes: r.notes == null ? null : String(r.notes),
              currency: String(r.currency ?? "KES"),
              amountDue: r.amountDue == null ? null : String(r.amountDue),
              odooSyncKey: String(r.odooSyncKey),
              odooQuotationId: r.odooQuotationId == null ? null : String(r.odooQuotationId),
              odooQuotationNumber:
                r.odooQuotationNumber == null ? null : String(r.odooQuotationNumber),
              odooSyncError: r.odooSyncError == null ? null : String(r.odooSyncError),
              truckRegistration: r.truckRegistration == null ? null : String(r.truckRegistration),
              driverName: r.driverName == null ? null : String(r.driverName),
              transporter: r.transporter == null ? null : String(r.transporter),
              loadedPmsLitres: r.loadedPmsLitres == null ? null : Number(r.loadedPmsLitres),
              loadedAgoLitres: r.loadedAgoLitres == null ? null : Number(r.loadedAgoLitres),
              loadingReference: r.loadingReference == null ? null : String(r.loadingReference),
              loadingStartedAt: toDate(r.loadingStartedAt),
              loadingCompletedAt: toDate(r.loadingCompletedAt),
              sealNumbers: r.sealNumbers == null ? null : String(r.sealNumbers),
              deliveryNoteRef: r.deliveryNoteRef == null ? null : String(r.deliveryNoteRef),
              dispatchedAt: toDate(r.dispatchedAt),
              deliveredAt: toDate(r.deliveredAt),
              createdAt: requireDate(r.createdAt),
              updatedAt: requireDate(r.updatedAt),
            })),
          });
        }

        if (lines.length) {
          await tx.dealerOrderLine.createMany({
            data: lines.map((r) => ({
              id: String(r.id),
              orderId: String(r.orderId),
              product: r.product as never,
              quantityLitres: Number(r.quantityLitres),
            })),
          });
        }

        if (proformas.length) {
          await tx.proFormaInvoice.createMany({
            data: proformas.map((r) => ({
              id: String(r.id),
              orderId: String(r.orderId),
              number: String(r.number),
              amount: String(r.amount),
              currency: String(r.currency ?? "KES"),
              issuedAt: requireDate(r.issuedAt),
              odooDocumentId: r.odooDocumentId == null ? null : String(r.odooDocumentId),
              documentPath: r.documentPath == null ? null : String(r.documentPath),
            })),
          });
        }

        if (payments.length) {
          await tx.paymentRecord.createMany({
            data: payments.map((r) => ({
              id: String(r.id),
              orderId: String(r.orderId),
              amount: String(r.amount),
              bankReference: r.bankReference == null ? null : String(r.bankReference),
              transactionReference:
                r.transactionReference == null ? null : String(r.transactionReference),
              paymentDate: toDate(r.paymentDate),
              proofPath: r.proofPath == null ? null : String(r.proofPath),
              status: r.status as never,
              note: r.note == null ? null : String(r.note),
              submittedById: r.submittedById == null ? null : String(r.submittedById),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (history.length) {
          await tx.orderStatusHistory.createMany({
            data: history.map((r) => ({
              id: String(r.id),
              orderId: String(r.orderId),
              fromStatus: r.fromStatus == null ? null : String(r.fromStatus),
              toStatus: String(r.toStatus),
              actorId: r.actorId == null ? null : String(r.actorId),
              note: r.note == null ? null : String(r.note),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (documents.length) {
          await tx.orderDocument.createMany({
            data: documents.map((r) => ({
              id: String(r.id),
              orderId: String(r.orderId),
              kind: String(r.kind),
              fileName: String(r.fileName),
              storagePath: String(r.storagePath),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }

        if (activity.length) {
          await tx.activityLog.createMany({
            data: activity.map((r) => ({
              id: String(r.id),
              actorId: r.actorId == null ? null : String(r.actorId),
              action: String(r.action),
              entity: r.entity == null ? null : String(r.entity),
              entityId: r.entityId == null ? null : String(r.entityId),
              metaJson: r.metaJson == null ? null : String(r.metaJson),
              createdAt: requireDate(r.createdAt),
            })),
          });
        }
      },
      { timeout: 120_000 }
    );

    const verify = {
      User: await prisma.user.count(),
      DealerOrganization: await prisma.dealerOrganization.count(),
      Station: await prisma.station.count(),
      DealerOrder: await prisma.dealerOrder.count(),
      DealerOrderLine: await prisma.dealerOrderLine.count(),
      OrderStatusHistory: await prisma.orderStatusHistory.count(),
      ActivityLog: await prisma.activityLog.count(),
      Depot: await prisma.depot.count(),
    };
    console.info("[transfer] Postgres row counts after import:");
    for (const [k, v] of Object.entries(verify)) {
      console.info(`  ${k}: ${v}`);
    }
    console.info("[transfer] Done. Password hashes preserved; values not printed.");
  } finally {
    await prisma.$disconnect();
    db.close();
  }
}

main().catch((err) => {
  console.error("[transfer] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
