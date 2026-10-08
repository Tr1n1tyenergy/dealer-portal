import Link from "next/link";
import type { DealerOrderStatus } from "@prisma/client";
import { requireDepot } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { depotOrderAction } from "@/lib/orders/actions";
import "../../dealer/dealer-portal.css";

const queues: { title: string; statuses: DealerOrderStatus[] }[] = [
  { title: "Ready for release", statuses: ["RELEASED_TO_DEPOT"] },
  { title: "Loading", statuses: ["LOADING"] },
  { title: "Ready to dispatch", statuses: ["LOADED"] },
  { title: "In transit", statuses: ["DISPATCHED", "IN_TRANSIT"] },
];

export default async function DepotDashboardPage() {
  const session = await requireDepot();
  const active: DealerOrderStatus[] = [
    "RELEASED_TO_DEPOT",
    "LOADING",
    "LOADED",
    "DISPATCHED",
    "IN_TRANSIT",
    "STOCK_EXCEPTION",
  ];
  const orders = await prisma.dealerOrder.findMany({
    where: {
      status: { in: active },
      ...(session.user.role === "SUPER_ADMIN" || !session.user.depotId
        ? {}
        : { depotId: session.user.depotId }),
    },
    include: { station: true, dealerOrganization: true, lines: true, depot: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="portal">
      <header className="portal-top">
        <div>
          <div className="portal-kicker">Depot operations</div>
          <h1>Today</h1>
          <p>Release queue, loading and dispatch. Only paid orders released by Trinity staff appear here.</p>
        </div>
      </header>
      {queues.map((queue) => {
        const rows = orders.filter((order) => (queue.statuses as string[]).includes(order.status));
        return (
          <section key={queue.title} className="portal-panel" style={{ marginTop: "1rem" }}>
            <div className="portal-panel__head"><h2>{queue.title}</h2><span>{rows.length}</span></div>
            {rows.map((order) => (
              <form key={order.id} action={depotOrderAction} className="portal-form" style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="orderId" value={order.id} />
                <strong>{order.reference}</strong> · {order.dealerOrganization.name} · {order.station.name}
                <div>
                  {order.lines.map((line) => `${line.product} ${line.quantityLitres.toLocaleString()} L`).join(" · ")}
                </div>
                {order.status === "RELEASED_TO_DEPOT" ? (
                  <>
                    <label>Truck<input name="truckRegistration" placeholder="Registration" /></label>
                    <label>Driver<input name="driverName" /></label>
                    <button name="action" value="accept" type="submit">Begin loading</button>
                  </>
                ) : null}
                {order.status === "LOADING" ? (
                  <>
                    <label>Loaded PMS<input name="loadedPmsLitres" type="number" /></label>
                    <label>Loaded AGO<input name="loadedAgoLitres" type="number" /></label>
                    <label>Loading reference<input name="loadingReference" /></label>
                    <button name="action" value="complete" type="submit">Loading complete</button>
                  </>
                ) : null}
                {order.status === "LOADED" ? <button name="action" value="dispatch" type="submit">Dispatch</button> : null}
                {order.status === "IN_TRANSIT" || order.status === "DISPATCHED" ? (
                  <>
                    <label>Delivery note<input name="deliveryNoteRef" /></label>
                    <button name="action" value="deliver" type="submit">Confirm delivery</button>
                  </>
                ) : null}
              </form>
            ))}
            {rows.length === 0 ? <p className="portal-note">Nothing in this queue.</p> : null}
          </section>
        );
      })}
      <p className="portal-note"><Link href="/access">Access gateway</Link></p>
    </div>
  );
}
