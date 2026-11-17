import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import {
  ACTIVITY_MODULES,
  classifyActionKind,
  classifyModule,
  classifyOutcome,
  describeActivity,
  initials,
  moduleLabel,
  parseMeta,
  sanitizeMetaForDisplay,
  type ActivityActionKind,
  type ActivityModuleKey,
} from "@/lib/settings/activity-present";
import type {
  ActivityFilterOptions,
  ActivityLogRow,
  ActivityQueryInput,
  ActivityStats,
} from "@/lib/settings/activity-log-types";

export type {
  ActivityDatePreset,
  ActivityFilterOptions,
  ActivityLogRow,
  ActivityQueryInput,
  ActivityStats,
} from "@/lib/settings/activity-log-types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveDateRange(input: ActivityQueryInput): { from: Date; to: Date } {
  const now = new Date();
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);

  switch (input.datePreset) {
    case "today":
      return { from: today0, to: today1 };
    case "yesterday": {
      const y = new Date(today0);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "30d": {
      const from = new Date(today0);
      from.setDate(from.getDate() - 29);
      return { from, to: today1 };
    }
    case "90d": {
      const from = new Date(today0);
      from.setDate(from.getDate() - 89);
      return { from, to: today1 };
    }
    case "custom": {
      const fromRaw = input.dateFrom ? new Date(input.dateFrom) : today0;
      const toRaw = input.dateTo ? new Date(input.dateTo) : today1;
      const from = startOfDay(Number.isNaN(fromRaw.getTime()) ? today0 : fromRaw);
      const to = endOfDay(Number.isNaN(toRaw.getTime()) ? today1 : toRaw);
      if (from > to) return { from: to, to: from };
      return { from, to };
    }
    case "7d":
    default: {
      const from = new Date(today0);
      from.setDate(from.getDate() - 6);
      return { from, to: today1 };
    }
  }
}

function moduleWhere(module: ActivityModuleKey): Prisma.ActivityLogWhereInput {
  switch (module) {
    case "auth":
      return {
        OR: [
          { action: { contains: "LOGIN", mode: "insensitive" } },
          { action: { contains: "PASSWORD", mode: "insensitive" } },
          { action: { contains: "ACTIVATED", mode: "insensitive" } },
        ],
      };
    case "permissions":
      return {
        OR: [
          { action: { contains: "PERMISSION", mode: "insensitive" } },
          { action: { contains: "ROLE", mode: "insensitive" } },
          { action: { contains: "ACCESS", mode: "insensitive" } },
          { entity: { in: ["StaffRoleTemplate", "SystemSetting"] } },
        ],
      };
    case "users":
      return {
        AND: [
          {
            OR: [
              { entity: "User" },
              { action: { startsWith: "USER_" } },
              { action: "STAFF_INVITED" },
            ],
          },
          {
            NOT: {
              OR: [
                { action: { contains: "LOGIN", mode: "insensitive" } },
                { action: { contains: "PASSWORD", mode: "insensitive" } },
                { action: { contains: "PERMISSION", mode: "insensitive" } },
              ],
            },
          },
        ],
      };
    case "orders":
      return {
        OR: [
          { entity: "DealerOrder" },
          { action: { contains: "ORDER", mode: "insensitive" } },
          { action: { contains: "PFI", mode: "insensitive" } },
          { action: { contains: "ODOO_QUOTATION", mode: "insensitive" } },
          { action: { contains: "PAYMENT", mode: "insensitive" } },
        ],
      };
    case "stations":
      return {
        OR: [{ entity: "Station" }, { action: { startsWith: "STATION_" } }],
      };
    case "tanks":
      return {
        OR: [{ entity: "StationTank" }, { action: { startsWith: "TANK_" } }],
      };
    case "fleet":
      return {
        OR: [{ entity: "FleetTruck" }, { action: { startsWith: "TRUCK_" } }],
      };
    case "reports":
      return {
        OR: [
          { entity: { in: ["Report", "NoteSession", "StockSaleReport"] } },
          { action: { contains: "REPORT", mode: "insensitive" } },
          { action: { contains: "NOTE_SESSION", mode: "insensitive" } },
        ],
      };
    case "presentations":
      return {
        OR: [{ entity: "Presentation" }, { action: { contains: "PRESENTATION", mode: "insensitive" } }],
      };
    case "support":
      return {
        OR: [{ entity: "SupportTicket" }, { action: { startsWith: "support.", mode: "insensitive" } }],
      };
    case "dealers":
      return {
        OR: [
          { entity: "DealerOrganization" },
          { action: { contains: "DEALER_", mode: "insensitive" } },
        ],
        NOT: { entity: "DealerOrder" },
      };
    case "settings":
      return {
        OR: [
          { action: { contains: "SETTINGS", mode: "insensitive" } },
          { action: "GO_LIVE_CLEANUP" },
        ],
      };
    default:
      return {};
  }
}

function actionKindWhere(kind: ActivityActionKind): Prisma.ActivityLogWhereInput {
  switch (kind) {
    case "login":
      return { action: { contains: "LOGIN", mode: "insensitive" } };
    case "deleted":
      return {
        OR: [
          { action: { contains: "DELETE", mode: "insensitive" } },
          { action: { contains: "REMOVED", mode: "insensitive" } },
          { action: { contains: "DEACTIVATED", mode: "insensitive" } },
        ],
      };
    case "access":
      return {
        OR: [
          { action: { contains: "PERMISSION", mode: "insensitive" } },
          { action: { contains: "ROLE", mode: "insensitive" } },
          { action: { contains: "ACCESS", mode: "insensitive" } },
          { action: { contains: "INVITED", mode: "insensitive" } },
          { action: { contains: "ACTIVATED", mode: "insensitive" } },
        ],
      };
    case "viewed":
      return {
        OR: [
          { action: { contains: "VIEW", mode: "insensitive" } },
          { action: { contains: "EXPORT", mode: "insensitive" } },
        ],
      };
    case "created":
      return {
        OR: [
          { action: { contains: "CREATE", mode: "insensitive" } },
          { action: { contains: "CREATED", mode: "insensitive" } },
          { action: { contains: "SUBMITTED", mode: "insensitive" } },
          { action: { contains: "GENERATED", mode: "insensitive" } },
          { action: { contains: "INVITED", mode: "insensitive" } },
        ],
      };
    case "updated":
      return {
        OR: [
          { action: { contains: "UPDATE", mode: "insensitive" } },
          { action: { contains: "CHANGED", mode: "insensitive" } },
          { action: { contains: "status", mode: "insensitive" } },
        ],
      };
    default:
      return {};
  }
}

async function stationScopeWhere(stationId: string): Promise<Prisma.ActivityLogWhereInput> {
  const [tanks, trucks, orders] = await Promise.all([
    prisma.stationTank.findMany({ where: { stationId }, select: { id: true } }),
    prisma.fleetTruck.findMany({ where: { stationId }, select: { id: true } }),
    prisma.dealerOrder.findMany({ where: { stationId }, select: { id: true }, take: 5000 }),
  ]);
  const tankIds = tanks.map((t) => t.id);
  const truckIds = trucks.map((t) => t.id);
  const orderIds = orders.map((o) => o.id);

  const or: Prisma.ActivityLogWhereInput[] = [
    { entity: "Station", entityId: stationId },
    { metaJson: { contains: stationId } },
  ];
  if (tankIds.length) or.push({ entity: "StationTank", entityId: { in: tankIds } });
  if (truckIds.length) or.push({ entity: "FleetTruck", entityId: { in: truckIds } });
  if (orderIds.length) or.push({ entity: "DealerOrder", entityId: { in: orderIds } });
  return { OR: or };
}

async function buildWhere(input: ActivityQueryInput): Promise<Prisma.ActivityLogWhereInput> {
  const { from, to } = resolveDateRange(input);
  const and: Prisma.ActivityLogWhereInput[] = [{ createdAt: { gte: from, lte: to } }];

  if (input.actorId) and.push({ actorId: input.actorId });
  if (input.module && input.module !== "ALL") and.push(moduleWhere(input.module));
  if (input.actionKind && input.actionKind !== "ALL") and.push(actionKindWhere(input.actionKind));
  if (input.stationId) and.push(await stationScopeWhere(input.stationId));

  return { AND: and };
}

async function enrichStationContext(
  rows: Array<{
    id: string;
    entity: string | null;
    entityId: string | null;
    metaJson: string | null;
  }>
): Promise<Map<string, { stationId: string | null; stationName: string | null }>> {
  const out = new Map<string, { stationId: string | null; stationName: string | null }>();
  const stationIds = new Set<string>();
  const tankIds = new Set<string>();
  const truckIds = new Set<string>();
  const orderIds = new Set<string>();

  for (const r of rows) {
    const meta = parseMeta(r.metaJson);
    const metaStationId = typeof meta.stationId === "string" ? meta.stationId : null;
    const metaStationName = typeof meta.stationName === "string" ? meta.stationName : null;
    if (metaStationId || metaStationName) {
      out.set(r.id, { stationId: metaStationId, stationName: metaStationName });
      continue;
    }
    if (r.entity === "Station" && r.entityId) stationIds.add(r.entityId);
    if (r.entity === "StationTank" && r.entityId) tankIds.add(r.entityId);
    if (r.entity === "FleetTruck" && r.entityId) truckIds.add(r.entityId);
    if (r.entity === "DealerOrder" && r.entityId) orderIds.add(r.entityId);
  }

  const [stations, tanks, trucks, orders] = await Promise.all([
    stationIds.size
      ? prisma.station.findMany({ where: { id: { in: [...stationIds] } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    tankIds.size
      ? prisma.stationTank.findMany({
          where: { id: { in: [...tankIds] } },
          select: { id: true, stationId: true, station: { select: { name: true } } },
        })
      : Promise.resolve([]),
    truckIds.size
      ? prisma.fleetTruck.findMany({
          where: { id: { in: [...truckIds] } },
          select: { id: true, stationId: true, station: { select: { name: true } } },
        })
      : Promise.resolve([]),
    orderIds.size
      ? prisma.dealerOrder.findMany({
          where: { id: { in: [...orderIds] } },
          select: { id: true, stationId: true, station: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));
  const tankMap = new Map(tanks.map((t) => [t.id, { stationId: t.stationId, name: t.station.name }]));
  const truckMap = new Map(
    trucks.map((t) => [t.id, { stationId: t.stationId, name: t.station?.name ?? null }])
  );
  const orderMap = new Map(
    orders.map((o) => [o.id, { stationId: o.stationId, name: o.station?.name ?? null }])
  );

  for (const r of rows) {
    if (out.has(r.id)) continue;
    if (r.entity === "Station" && r.entityId) {
      out.set(r.id, { stationId: r.entityId, stationName: stationMap.get(r.entityId) ?? null });
      continue;
    }
    if (r.entity === "StationTank" && r.entityId && tankMap.has(r.entityId)) {
      const t = tankMap.get(r.entityId)!;
      out.set(r.id, { stationId: t.stationId, stationName: t.name });
      continue;
    }
    if (r.entity === "FleetTruck" && r.entityId && truckMap.has(r.entityId)) {
      const t = truckMap.get(r.entityId)!;
      out.set(r.id, { stationId: t.stationId, stationName: t.name });
      continue;
    }
    if (r.entity === "DealerOrder" && r.entityId && orderMap.has(r.entityId)) {
      const o = orderMap.get(r.entityId)!;
      out.set(r.id, { stationId: o.stationId, stationName: o.name });
      continue;
    }
    out.set(r.id, { stationId: null, stationName: null });
  }
  return out;
}

function toRow(
  log: {
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    metaJson: string | null;
    createdAt: Date;
    actorId: string | null;
    actor: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    } | null;
  },
  station: { stationId: string | null; stationName: string | null }
): ActivityLogRow {
  const meta = parseMeta(log.metaJson);
  const settingsModule = classifyModule(log.action, log.entity);
  const actionKind = classifyActionKind(log.action);
  const outcome = classifyOutcome(log.action, meta);
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    module: settingsModule,
    moduleLabel: moduleLabel(settingsModule),
    actionKind,
    outcome,
    details: describeActivity(log.action, log.entity, meta),
    stationId: station.stationId,
    stationName: station.stationName,
    actorId: log.actorId,
    actorName: log.actor ? `${log.actor.firstName} ${log.actor.lastName}`.trim() : "System",
    actorInitials: log.actor ? initials(log.actor.firstName, log.actor.lastName, log.actor.email) : "SY",
    actorRole: log.actor?.role ?? null,
    actorEmail: log.actor?.email ?? null,
    meta: sanitizeMetaForDisplay(meta),
  };
}

export async function requireActivityView() {
  const session = await requireInternal();
  if (!canUser(session.user, "activity", "view")) {
    throw new Error("You do not have permission to view activity logs.");
  }
  return session;
}

export async function listActivityFilterOptions(): Promise<ActivityFilterOptions> {
  await requireActivityView();
  const [users, stations] = await Promise.all([
    prisma.user.findMany({
      where: { accountType: "INTERNAL" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
    prisma.station.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    users: users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
    stations,
    modules: ACTIVITY_MODULES,
  };
}

export async function queryActivityLogs(input: ActivityQueryInput): Promise<{
  rows: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: ActivityStats;
}> {
  await requireActivityView();
  const pageSize = Math.min(50, Math.max(5, input.pageSize ?? 8));
  const page = Math.max(1, input.page ?? 1);
  const where = await buildWhere(input);
  const sort = input.sort === "asc" ? "asc" : "desc";

  const [total, rawRows, updateCount, deleteCount, accessCount, failedCount] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: sort },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activityLog.count({
      where: { AND: [where, actionKindWhere("updated")] },
    }),
    prisma.activityLog.count({
      where: { AND: [where, actionKindWhere("deleted")] },
    }),
    prisma.activityLog.count({
      where: {
        AND: [
          where,
          {
            OR: [actionKindWhere("access"), actionKindWhere("login")],
          },
        ],
      },
    }),
    prisma.activityLog.count({
      where: {
        AND: [
          where,
          {
            OR: [
              { action: { contains: "REFUSED", mode: "insensitive" } },
              { action: { contains: "FAILED", mode: "insensitive" } },
              { action: { contains: "REJECTED", mode: "insensitive" } },
            ],
          },
        ],
      },
    }),
  ]);

  const stations = await enrichStationContext(rawRows);
  const rows = rawRows.map((r) => toRow(r, stations.get(r.id) ?? { stationId: null, stationName: null }));

  return {
    rows,
    total,
    page,
    pageSize,
    stats: {
      total,
      successful: Math.max(0, total - failedCount),
      updates: updateCount,
      deletions: deleteCount,
      access: accessCount,
    },
  };
}

export async function exportActivityLogsCsv(input: ActivityQueryInput): Promise<string> {
  await requireActivityView();
  const where = await buildWhere(input);
  const rawRows = await prisma.activityLog.findMany({
    where,
    include: {
      actor: { select: { firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });
  const stations = await enrichStationContext(rawRows);
  const rows = rawRows.map((r) => toRow(r, stations.get(r.id) ?? { stationId: null, stationName: null }));

  const headers = [
    "Event ID",
    "Timestamp",
    "User",
    "Action",
    "Module",
    "Description",
    "Station",
    "Status",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.id,
      r.createdAt,
      r.actorName,
      r.action,
      r.moduleLabel,
      r.details,
      r.stationName ?? "",
      r.outcome === "success" ? "Success" : "Failed",
    ].map((c) => {
      let s = String(c ?? "");
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    });
    lines.push(cells.join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
