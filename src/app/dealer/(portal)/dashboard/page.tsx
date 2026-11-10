import Link from "next/link";
import {
  BarChart3,
  Check,
  ChevronRight,
  FileText,
  Mail,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";
import type { DealerOrderStatus } from "@prisma/client";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listConversationsForUser } from "@/lib/messaging/service";
import {
  dealerStatusLabel,
  dealerTrackerSteps,
  type DealerTrackerStep,
} from "@/lib/orders/state-machine";
import { formatKes } from "@/lib/orders/money";
import { nairobiMonthStart, nairobiParts } from "@/lib/time/nairobi";
import {
  EPRA_TEMP_PRICES_BY_WAREHOUSE,
  epraUnitPriceForStation,
} from "@/lib/integrations/odoo/epra-temp-prices";
import { fulfillmentForStation } from "@/lib/integrations/odoo/quotation-contract";
import { FuelOrderedPanel } from "@/components/dealer/fuel-ordered-panel";
import { PayPfiPanel } from "@/components/dealer/pay-pfi-panel";
import { cn } from "@/lib/utils";
import { dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import { LiveRefresh } from "@/components/live/live-refresh";
import { ordersDealerChannel } from "@/lib/pusher/server-channels";
import { DEALER_PAYABLE_STATUSES, toPayPfiProps } from "@/lib/dealer/pay-pfi";
import "../../dealer-dashboard.css";

const PAYABLE: DealerOrderStatus[] = DEALER_PAYABLE_STATUSES;
const ON_THE_WAY: DealerOrderStatus[] = [
  "RELEASED_TO_DEPOT",
  "LOADING",
  "LOADED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERY_EXCEPTION",
];
const TRACKABLE: DealerOrderStatus[] = [
  ...PAYABLE,
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFICATION",
  "PAYMENT_CONFIRMED",
  ...ON_THE_WAY,
];

function greeting() {
  const { hour } = nairobiParts();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function relativeAge(from: Date, now = new Date()) {
  const mins = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (mins < 60) return `${mins} m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days} d ${remH} h` : `${days} d`;
}

function formatClock(at: Date) {
  const { hour } = nairobiParts(at);
  const local = new Date(at.getTime() + 3 * 60 * 60 * 1000);
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return `${String(hour).padStart(2, "0")}:${m}`;
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function statusPillTone(status: DealerOrderStatus) {
  const label = dealerStatusLabel(status);
  if (label === "Delivered" || label === "Closed") return "delivered";
  if (label === "In Transit" || label === "Dispatched" || label === "Loaded") return "transit";
  if (label.includes("Payment") || label === "PFI Ready" || label === "Awaiting Payment") return "payment";
  return "processing";
}

function productLine(pms: number, ago: number) {
  const parts: string[] = [];
  if (pms) parts.push(`${pms.toLocaleString("en-US")} L PMS`);
  if (ago) parts.push(`${ago.toLocaleString("en-US")} L AGO`);
  return parts.join(" · ") || "—";
}

function stepSecondary(item: DealerTrackerStep) {
  if (item.state === "done") return "Done";
  if (item.state === "pending") return "Pending";
  if (item.state === "stopped") return "—";
  return item.note ?? (item.state === "attention" ? "Needs attention" : "In progress");
}

function trackerHeadline(status: DealerOrderStatus) {
  switch (status) {
    case "PFI_ISSUED":
    case "AWAITING_PAYMENT":
      return {
        title: "Payment pending",
        detail: "Your Pro Forma Invoice is ready. Complete payment to release the order to depot.",
      };
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
      return {
        title: "Payment under review",
        detail: "Payment details have been received and are being verified by Trinity finance.",
      };
    case "PAYMENT_EXCEPTION":
      return {
        title: "Payment needs attention",
        detail: "Trinity finance couldn't verify your payment. Open the order to resubmit details.",
      };
    case "RELEASED_TO_DEPOT":
      return {
        title: "Released to depot",
        detail: "Your order has been released to the depot and is waiting to enter loading.",
      };
    case "LOADING":
    case "LOADED":
      return {
        title: "Loading in progress",
        detail: "Your order has been released to the depot and is currently in the loading stage.",
      };
    case "DISPATCHED":
    case "IN_TRANSIT":
      return {
        title: "Your delivery is on the way",
        detail: "Your fuel order is in transit to the delivery station.",
      };
    case "DELIVERED":
    case "CLOSED":
      return { title: "Order delivered", detail: "Fuel has been delivered to your station." };
    default:
      return {
        title: dealerStatusLabel(status),
        detail: "Track each stage of this order as Trinity processes it.",
      };
  }
}

export default async function DealerDashboardPage() {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const now = new Date();
  const monthStart = nairobiMonthStart(now);
  const nextMonth = nairobiMonthStart(now, 1);

  const [org, orders, stations, conversations] = await Promise.all([
    prisma.dealerOrganization.findUnique({ where: { id: orgId } }),
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId },
      include: { station: true, lines: true, proforma: true, depot: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.station.findMany({
      where: { dealerOrganizationId: orgId },
      orderBy: { name: "asc" },
    }),
    listConversationsForUser(session.user.id).catch(() => []),
  ]);

  const orgName =
    stations[0]?.tradingName || stations[0]?.name || org?.name || session.user.firstName || "Dealer";

  const payable = orders.filter((o) => PAYABLE.includes(o.status) && o.proforma);
  const toPayCents = payable.reduce((sum, o) => {
    const raw = (o.proforma?.amount || o.amountDue || "").replace(/,/g, "");
    const n = Number(raw);
    return sum + (Number.isFinite(n) ? Math.round(n * 100) : 0);
  }, 0);
  const oldestPayable = payable
    .slice()
    .sort(
      (a, b) =>
        (a.proforma?.issuedAt?.getTime() ?? a.createdAt.getTime()) -
        (b.proforma?.issuedAt?.getTime() ?? b.createdAt.getTime())
    )[0];

  const onTheWay =
    orders.find((o) => ON_THE_WAY.includes(o.status)) ??
    orders.find((o) => o.status === "PAYMENT_CONFIRMED") ??
    null;

  const trackOrder =
    orders.find((o) => TRACKABLE.includes(o.status)) ??
    orders.find((o) => !["CANCELLED", "REJECTED", "CLOSED", "DRAFT"].includes(o.status)) ??
    null;

  const monthOrders = orders.filter(
    (o) => o.createdAt >= monthStart && o.createdAt < nextMonth && o.status !== "CANCELLED" && o.status !== "REJECTED"
  );
  let monthPms = 0;
  let monthAgo = 0;
  let monthValueCents = 0;
  for (const o of monthOrders) {
    for (const line of o.lines) {
      if (line.product === "PMS") monthPms += line.quantityLitres;
      if (line.product === "AGO") monthAgo += line.quantityLitres;
    }
    const raw = (o.amountDue || o.proforma?.amount || "").replace(/,/g, "");
    const n = Number(raw);
    if (Number.isFinite(n)) monthValueCents += Math.round(n * 100);
  }
  const monthLitres = monthPms + monthAgo;
  const pmsShare = monthLitres > 0 ? Math.round((monthPms / monthLitres) * 100) : 0;

  const awaitingPayment = payable.length;
  const inTransit = orders.filter((o) => ["DISPATCHED", "IN_TRANSIT"].includes(o.status)).length;
  const summaryParts: string[] = [];
  if (awaitingPayment === 1) summaryParts.push("One PFI is awaiting payment");
  else if (awaitingPayment > 1) summaryParts.push(`${awaitingPayment} PFIs are awaiting payment`);
  if (inTransit === 1) summaryParts.push("one delivery is on the road");
  else if (inTransit > 1) summaryParts.push(`${inTransit} deliveries are on the road`);
  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(" and ")}.`
      : "Place fuel orders, open PFIs, make payments and track deliveries — all in one place.";

  const chartPoints = Array.from({ length: 6 }, (_, i) => {
    const start = nairobiMonthStart(now, i - 5);
    const end = nairobiMonthStart(now, i - 4);
    const { year, month } = nairobiParts(start);
    let pms = 0;
    let ago = 0;
    for (const o of orders) {
      if (o.createdAt < start || o.createdAt >= end) continue;
      if (o.status === "CANCELLED" || o.status === "REJECTED") continue;
      for (const line of o.lines) {
        if (line.product === "PMS") pms += line.quantityLitres;
        if (line.product === "AGO") ago += line.quantityLitres;
      }
    }
    return {
      key: `${year}-${month}`,
      label: monthLabel(year, month),
      pms,
      ago,
    };
  });

  const priceStation = stations.find((s) => s.code) ?? stations[0] ?? null;
  const fulfillment = priceStation?.code ? fulfillmentForStation(priceStation.code) : null;
  const epra = fulfillment ? EPRA_TEMP_PRICES_BY_WAREHOUSE[fulfillment.warehouseKey] : null;
  const pmsPrice = priceStation?.code ? epraUnitPriceForStation(priceStation.code, "PMS") : null;
  const agoPrice = priceStation?.code ? epraUnitPriceForStation(priceStation.code, "AGO") : null;
  const sampleLitres = 10_000;
  const sampleTotal =
    pmsPrice == null ? null : Math.round(sampleLitres * pmsPrice * 1.08 * 100) / 100;

  const recent = orders.slice(0, 5);
  const latestChat = conversations[0] ?? null;
  const tracker = trackOrder ? dealerTrackerSteps(trackOrder.status) : null;
  const trackHeadline = trackOrder ? trackerHeadline(trackOrder.status) : null;
  const trackActiveIndex =
    tracker?.steps.findIndex((s) => s.state === "active" || s.state === "attention") ?? -1;
  const trackStageLabel = !tracker
    ? null
    : tracker.stopped
      ? "Stopped"
      : trackActiveIndex >= 0
        ? `Stage ${trackActiveIndex + 1} of ${tracker.steps.length}`
        : tracker.steps.every((s) => s.state === "done")
          ? `Stage ${tracker.steps.length} of ${tracker.steps.length}`
          : null;

  const onWayPms = onTheWay?.lines.find((l) => l.product === "PMS")?.quantityLitres ?? 0;
  const onWayAgo = onTheWay?.lines.find((l) => l.product === "AGO")?.quantityLitres ?? 0;

  return (
    <div className="dd">
      <section className="dd__hero" style={dealerHeroPhotoStyle}>
        <div className="dd__hero-veil" aria-hidden />
        <div className="dd__hero-inner">
          <div className="dd__eyebrow">
            <span className="dd__eyebrow-line" aria-hidden />
            <span className="dd__eyebrow-text">Dealer Portal</span>
            <LiveRefresh channel={ordersDealerChannel(orgId)} />
          </div>
          <h1>
            {greeting()}, {orgName}
          </h1>
          <p className="dd__hero-summary">{summary}</p>
          <div className="dd__hero-actions">
            <Link href="/dealer/orders/new" className="dd__btn dd__btn--primary">
              Place an order
            </Link>
            {oldestPayable && oldestPayable.proforma ? (
              <PayPfiPanel
                {...toPayPfiProps({
                  ...oldestPayable,
                  dealerOrganization: { name: org?.name ?? orgName },
                })!}
                variant="inline"
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="dd__inner">
        <section className="dd__kpis" aria-label="Account summary">
          <Link href="/dealer/orders?view=payment" className="dd__kpi dd__kpi--pay">
            <span className="dd__kpi-icon">
              <Wallet size={16} />
            </span>
            <span className="dd__kpi-copy">
              <div className="dd__kpi-label">To pay</div>
              <div className="dd__kpi-value">
                {toPayCents > 0
                  ? `KES ${(toPayCents / 100).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "KES 0.00"}
              </div>
              <div className="dd__kpi-meta">
                {payable.length === 0
                  ? "No PFIs waiting"
                  : `${payable.length} PFI${payable.length === 1 ? "" : "s"}${
                      oldestPayable
                        ? ` · oldest waiting ${relativeAge(
                            oldestPayable.proforma?.issuedAt ?? oldestPayable.createdAt
                          )}`
                        : ""
                    }`}
              </div>
            </span>
            <ChevronRight className="dd__kpi-go" size={18} />
          </Link>

          <Link
            href={onTheWay ? `/dealer/orders/${onTheWay.id}` : "/dealer/orders?view=deliveries"}
            className="dd__kpi"
          >
            <span className="dd__kpi-icon">
              <Truck size={16} />
            </span>
            <span className="dd__kpi-copy">
              <div className="dd__kpi-label">On the way</div>
              <div className="dd__kpi-value">{onTheWay?.reference ?? "None active"}</div>
              <div className="dd__kpi-meta">
                {onTheWay
                  ? `${dealerStatusLabel(onTheWay.status)} · ${productLine(onWayPms, onWayAgo)}`
                  : "No deliveries in progress"}
              </div>
              {onTheWay ? (
                <span className="dd__badge-live">Updated {formatClock(onTheWay.updatedAt)}</span>
              ) : null}
            </span>
            <ChevronRight className="dd__kpi-go" size={18} />
          </Link>

          <Link href="/dealer/orders" className="dd__kpi dd__kpi--month">
            <span className="dd__kpi-icon">
              <BarChart3 size={16} />
            </span>
            <span className="dd__kpi-copy">
              <div className="dd__kpi-label">This month</div>
              <div className="dd__kpi-value">{monthLitres.toLocaleString("en-US")} L</div>
              <div className="dd__kpi-meta">
                {monthOrders.length} order{monthOrders.length === 1 ? "" : "s"}
                {monthValueCents > 0
                  ? ` · KES ${(monthValueCents / 100 / 1_000_000).toFixed(1)}M`
                  : ""}
              </div>
              {monthLitres > 0 ? (
                <div className="dd__kpi-mix">
                  <div className="dd__kpi-bar" aria-hidden>
                    <span style={{ width: `${pmsShare}%` }} />
                    <i style={{ width: `${100 - pmsShare}%` }} />
                  </div>
                  <em>PMS {pmsShare}%</em>
                </div>
              ) : null}
            </span>
            <ChevronRight className="dd__kpi-go" size={18} />
          </Link>
        </section>

        <section className="dd__tracker">
          {trackOrder && tracker ? (
            <>
              <div className="dd__tracker-head">
                <div className="dd__tracker-lead">
                  <span className="dd__tracker-icon" aria-hidden>
                    <Truck size={20} strokeWidth={2.2} />
                  </span>
                  <div>
                    <div className="dd__tracker-kicker">Current order status</div>
                    <div className="dd__tracker-title">{trackHeadline?.title}</div>
                    <div className="dd__tracker-sub">
                      {trackOrder.reference} · {trackOrder.station.name}
                      {tracker.stopped ? ` · ${tracker.stopped}` : ""}
                    </div>
                    <p className="dd__tracker-detail">{trackHeadline?.detail}</p>
                  </div>
                </div>
                <div className="dd__tracker-actions">
                  {trackStageLabel ? <span className="dd__stage-pill">{trackStageLabel}</span> : null}
                  <Link href={`/dealer/orders/${trackOrder.id}`} className="dd__tracker-open">
                    Open order →
                  </Link>
                </div>
              </div>
              <ol
                className={cn("dd__progress", tracker.stopped && "is-stopped")}
                aria-label="Order progress"
              >
                {tracker.steps.map((step, index) => {
                  const next = tracker.steps[index + 1];
                  const connectorClass =
                    step.state === "done"
                      ? next && next.state !== "done"
                        ? "is-active"
                        : "is-done"
                      : "";
                  const isCurrent = step.state === "active" || step.state === "attention";
                  return (
                    <li
                      key={step.key}
                      className={cn("dd__progress-step", `is-${step.state}`)}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <div className="dd__progress-rail">
                        <div className="dd__progress-node">
                          <span className="dd__progress-dot">
                            {step.state === "done" ? (
                              <Check size={14} strokeWidth={3} />
                            ) : step.state === "attention" ? (
                              "!"
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="dd__progress-label">{step.label}</span>
                          <small className="dd__progress-note">{stepSecondary(step)}</small>
                        </div>
                        {index < tracker.steps.length - 1 ? (
                          <span className={cn("dd__progress-line", connectorClass)} aria-hidden />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <div className="dd__empty">
              No active order to track yet.{" "}
              <Link href="/dealer/orders/new" className="dd__card-link">
                Place an order →
              </Link>
            </div>
          )}
        </section>

        <section className="dd__row">
          <FuelOrderedPanel points={chartPoints} />

          <article className="dd__card">
            <div className="dd__card-head">
              <div>
                <div className="dd__card-title">
                  <span className="dd__card-icon">
                    <Tag size={15} />
                  </span>
                  Today&apos;s prices
                </div>
              </div>
            </div>
            <div className="dd__prices-meta">
              {epra && priceStation
                ? `${priceStation.name} · EPRA ${epra.epraTown} list valid to ${new Date(
                    epra.periodTo + "T12:00:00Z"
                  ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                : "Station price list unavailable"}
            </div>
            {pmsPrice != null && agoPrice != null ? (
              <>
                <div className="dd__price-row">
                  <span>PMS per litre</span>
                  <strong>KES {pmsPrice.toFixed(2)}</strong>
                </div>
                <div className="dd__price-row">
                  <span>AGO per litre</span>
                  <strong>KES {agoPrice.toFixed(2)}</strong>
                </div>
                {sampleTotal != null ? (
                  <div className="dd__price-calc">
                    {sampleLitres.toLocaleString("en-US")} L PMS today ≈ KES{" "}
                    {sampleTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    incl. 8% VAT
                  </div>
                ) : null}
              </>
            ) : (
              <div className="dd__empty">Current EPRA prices are not available for this station.</div>
            )}
          </article>
        </section>

        <section className="dd__row">
          <article className="dd__card">
            <div className="dd__card-head">
              <div className="dd__card-title">
                <span className="dd__card-icon">
                  <FileText size={15} />
                </span>
                Orders
              </div>
              <Link href="/dealer/orders" className="dd__card-link">
                See all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="dd__empty">
                No orders yet.{" "}
                <Link href="/dealer/orders/new" className="dd__card-link">
                  Place an order →
                </Link>
              </div>
            ) : (
              <div className="dd__orders">
                {recent.map((order) => {
                  const pms = order.lines.find((l) => l.product === "PMS")?.quantityLitres ?? 0;
                  const ago = order.lines.find((l) => l.product === "AGO")?.quantityLitres ?? 0;
                  return (
                    <Link key={order.id} href={`/dealer/orders/${order.id}`} className="dd__order">
                      <span className="dd__order-ref">{order.reference}</span>
                      <span className="dd__order-products">{productLine(pms, ago)}</span>
                      <span className="dd__order-amount">
                        {formatKes(order.amountDue || order.proforma?.amount)}
                      </span>
                      <span className={cn("dd__pill", `dd__pill--${statusPillTone(order.status)}`)}>
                        {dealerStatusLabel(order.status)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>

          <article className="dd__card" id="stations">
            <div className="dd__card-head">
              <div className="dd__card-title">
                <span className="dd__card-icon">
                  <Mail size={15} />
                </span>
                Messages
              </div>
              <Link href="/dealer/messaging" className="dd__card-link">
                Open →
              </Link>
            </div>
            {latestChat ? (
              <Link href="/dealer/messaging" className="dd__msg">
                <span className="dd__msg-avatar">
                  {(latestChat.peer?.firstName?.[0] || latestChat.displayName[0] || "T").toUpperCase()}
                  {(latestChat.peer?.lastName?.[0] || "").toUpperCase()}
                </span>
                <span>
                  <div className="dd__msg-name">{latestChat.displayName}</div>
                  <div className="dd__msg-body">
                    {latestChat.lastMessage?.body?.slice(0, 120) || "No messages yet"}
                  </div>
                  {latestChat.lastMessageAt ? (
                    <div className="dd__msg-time">{relativeAge(new Date(latestChat.lastMessageAt))} ago</div>
                  ) : null}
                </span>
              </Link>
            ) : (
              <div className="dd__empty">
                No conversations yet.{" "}
                <Link href="/dealer/messaging" className="dd__card-link">
                  Open messaging →
                </Link>
              </div>
            )}
          </article>
        </section>

        {/* Stations remain reachable via mobile menu / #stations anchor */}
        {stations.length > 0 ? (
          <p className="dd__empty" style={{ marginTop: "0.75rem" }}>
            Stations: {stations.map((s) => s.name).join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
