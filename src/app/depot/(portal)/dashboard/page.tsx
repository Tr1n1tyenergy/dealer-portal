import type { DealerOrderStatus } from "@prisma/client";
import { depotOrderScope } from "@/lib/access";
import { requireDepot } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { depotOrderAction } from "@/lib/orders/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NumericInput } from "@/components/forms/numeric-input";
import "../../../dealer/dealer-portal.css";

const queues: { title: string; statuses: DealerOrderStatus[] }[] = [
  { title: "Documents received", statuses: ["DEPOT_DOCS_RECEIVED"] },
  { title: "Ready for release", statuses: ["RELEASED_TO_DEPOT"] },
  { title: "Loading", statuses: ["LOADING"] },
  { title: "Ready to dispatch", statuses: ["LOADED"] },
  { title: "On the way", statuses: ["DISPATCHED", "IN_TRANSIT"] },
];

export default async function DepotDashboardPage() {
  const session = await requireDepot();
  const active: DealerOrderStatus[] = [
    "DEPOT_DOCS_RECEIVED",
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
      ...depotOrderScope(session.user),
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
          <p>Loading starts once the loading order, gate pass and sale order are on the order. Release sends the truck to the station.</p>
        </div>
        <SignOutButton />
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
                {order.status === "DEPOT_DOCS_RECEIVED" ? (
                  <button name="action" value="receive-docs" type="submit">Start loading</button>
                ) : null}
                {order.status === "RELEASED_TO_DEPOT" ? (
                  <>
                    <label>Truck<input name="truckRegistration" maxLength={500} placeholder="Registration" /></label>
                    <label>Driver<input name="driverName" maxLength={500} /></label>
                    <button name="action" value="accept" type="submit">Begin loading</button>
                  </>
                ) : null}
                {order.status === "LOADING" ? (
                  <>
                    <label>Loaded PMS<NumericInput name="loadedPmsLitres" /></label>
                    <label>Loaded AGO<NumericInput name="loadedAgoLitres" /></label>
                    <label>Loading reference<input name="loadingReference" maxLength={500} /></label>
                    <button name="action" value="complete" type="submit">Loading complete</button>
                    <button name="action" value="release-station" type="submit">Release to station</button>
                  </>
                ) : null}
                {order.status === "LOADED" ? <button name="action" value="dispatch" type="submit">Dispatch</button> : null}
                {order.status === "IN_TRANSIT" || order.status === "DISPATCHED" ? (
                  <>
                    <label>Delivery note<input name="deliveryNoteRef" maxLength={500} /></label>
                    <button name="action" value="deliver" type="submit">Confirm delivery</button>
                  </>
                ) : null}
              </form>
            ))}
            {rows.length === 0 ? <p className="portal-note">Nothing in this queue.</p> : null}
          </section>
        );
      })}
    </div>
  );
}
