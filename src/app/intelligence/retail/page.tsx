import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function RetailDashboardPage() {
  const [byStatus, recent, syncFailures, dealerCount, pendingUsers] = await Promise.all([
    prisma.dealerOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.dealerOrder.findMany({
      take: 12,
      orderBy: { updatedAt: "desc" },
      include: {
        dealerOrganization: { select: { name: true, code: true } },
        station: { select: { name: true, tradingName: true } },
      },
    }),
    prisma.dealerOrder.count({
      where: {
        OR: [{ status: "ODOO_SYNC_FAILED" }, { odooSyncError: { not: null } }],
      },
    }),
    prisma.dealerOrganization.count(),
    prisma.user.count({ where: { status: "PENDING", accountType: { in: ["DEALER", "INTERNAL"] } } }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
  const totalOrders = byStatus.reduce((sum, r) => sum + r._count._all, 0);

  return (
    <>
      <h1 className="ri-page-title">Dashboard</h1>
      <p className="ri-page-sub">Dealer order analytics and retail operations overview.</p>

      <div className="ri-metrics">
        <div className="ri-metric">
          <div className="ri-metric__label">Orders</div>
          <div className="ri-metric__value">{totalOrders}</div>
        </div>
        <div className="ri-metric">
          <div className="ri-metric__label">Sync failures</div>
          <div className="ri-metric__value">{syncFailures}</div>
        </div>
        <div className="ri-metric">
          <div className="ri-metric__label">Dealer orgs</div>
          <div className="ri-metric__value">{dealerCount}</div>
        </div>
        <div className="ri-metric">
          <div className="ri-metric__label">Pending invites</div>
          <div className="ri-metric__value">{pendingUsers}</div>
        </div>
        <div className="ri-metric">
          <div className="ri-metric__label">Submitted</div>
          <div className="ri-metric__value">{statusMap.SUBMITTED ?? 0}</div>
        </div>
        <div className="ri-metric">
          <div className="ri-metric__label">In fulfillment</div>
          <div className="ri-metric__value">
            {(statusMap.QUOTATION_READY ?? 0) +
              (statusMap.PFI_ISSUED ?? 0) +
              (statusMap.AWAITING_PAYMENT ?? 0) +
              (statusMap.PAYMENT_CONFIRMED ?? 0) +
              (statusMap.RELEASED_TO_DEPOT ?? 0)}
          </div>
        </div>
      </div>

      <div className="ri-panel">
        <div className="ri-panel__title">Recent orders</div>
        <table className="ri-table">
          <thead>
            <tr>
              <th>Org</th>
              <th>Station</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--ri-muted)" }}>
                  No dealer orders yet.
                </td>
              </tr>
            ) : (
              recent.map((o) => (
                <tr key={o.id}>
                  <td>{o.dealerOrganization.name}</td>
                  <td>{o.station.tradingName || o.station.name}</td>
                  <td>
                    <span className="ri-badge">{o.status}</span>
                  </td>
                  <td>{o.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p style={{ marginTop: "0.9rem", fontSize: "0.85rem", color: "var(--ri-muted)" }}>
          Full ops tools remain at{" "}
          <Link href="/intelligence/reports/dealer-operations" style={{ color: "var(--ri-gold-bright)" }}>
            Dealer Operations
          </Link>
          .
        </p>
      </div>
    </>
  );
}
