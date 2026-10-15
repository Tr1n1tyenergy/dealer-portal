import Link from "next/link";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { internalOrderAction } from "@/lib/orders/actions";
import { can } from "@/lib/access";
import { formatKes, sameAmount } from "@/lib/orders/money";

export default async function DealerOperationsPage() {
  const session = await requireInternal();
  const [orders, depots] = await Promise.all([
    prisma.dealerOrder.findMany({
      include: {
        dealerOrganization: true,
        station: true,
        lines: true,
        proforma: true,
        depot: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.depot.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">Retail Interface</div>
        <h1 className="mt-2 text-3xl font-black text-white">Dealer Operations</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Internal command view for dealer fuel orders. Commercial documents are created in Odoo. This screen tracks workflow, payment confirmation and depot release.
        </p>
        <Link href="/intelligence/reports" className="mt-3 inline-block text-sm font-bold text-trinity-gold">Back to Retail Interface</Link>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white text-slate-800 shadow-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Dealer</th>
              <th className="p-3">Station</th>
              <th className="p-3">Quotation</th>
              <th className="p-3">PFI</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="p-3 font-bold">{order.reference}</td>
                <td className="p-3">{order.dealerOrganization.name}</td>
                <td className="p-3">{order.station.name}</td>
                <td className="p-3">{order.odooQuotationNumber ?? "—"}</td>
                <td className="p-3">{order.proforma?.number ?? "—"}</td>
                <td className="whitespace-nowrap p-3">
                  {formatKes(order.amountDue)}
                  {order.payments[0] ? (
                    sameAmount(order.amountDue, order.payments[0].amount) ? (
                      <div className="mt-1 text-xs text-emerald-700">Paid: {formatKes(order.payments[0].amount)}</div>
                    ) : (
                      <div className="mt-1 text-xs font-semibold text-amber-700">
                        Paid: {formatKes(order.payments[0].amount)} (does not match)
                      </div>
                    )
                  ) : null}
                </td>
                <td className="p-3">
                  {order.status}
                  {order.odooSyncError && order.status === "QUOTATION_READY" ? (
                    <div className="mt-1 max-w-xs text-xs text-amber-700">Last PFI attempt failed: {order.odooSyncError}</div>
                  ) : null}
                </td>
                <td className="p-3">
                  {can(session.user.role, "orders.act") ? (
                  <form action={internalOrderAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    {order.status === "ODOO_SYNC_FAILED" ? <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" name="action" value="retry-sync">Retry sync</button> : null}
                    {order.status === "QUOTATION_READY" || order.status === "PFI_PENDING" ? <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" name="action" value="generate-pfi">Generate PFI</button> : null}
                    {order.status === "PAYMENT_VERIFICATION" ? (
                      <>
                        <button className="rounded-lg bg-emerald-700 px-2 py-1 text-xs text-white" name="action" value="confirm-payment">Confirm payment</button>
                        <button className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white" name="action" value="reject-payment">Flag exception</button>
                      </>
                    ) : null}
                    {order.status === "PAYMENT_CONFIRMED" ? (
                      <>
                        <select name="depotId" className="rounded border px-2 py-1 text-xs" defaultValue={depots[0]?.id}>
                          {depots.map((depot) => <option key={depot.id} value={depot.id}>{depot.name}</option>)}
                        </select>
                        <button className="rounded-lg bg-[#0a235b] px-2 py-1 text-xs text-white" name="action" value="release">Release to depot</button>
                      </>
                    ) : null}
                  </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {orders.length === 0 ? <tr><td className="p-4" colSpan={8}>No dealer orders yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
