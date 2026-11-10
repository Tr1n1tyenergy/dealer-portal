import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronRight,
  Download,
  Droplets,
  ExternalLink,
  FileText,
  Fuel,
  MapPin,
  StickyNote,
  Tag,
  Truck,
} from "lucide-react";
import type { DealerOrderStatus } from "@prisma/client";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  dealerStatusLabel,
  dealerTrackerSteps,
  type DealerTrackerStep,
} from "@/lib/orders/state-machine";
import { OrderTrackingNav } from "@/components/dealer/order-tracking-nav";
import { DealerHeroActions } from "@/components/dealer/dealer-hero-actions";
import { dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import { LiveRefresh } from "@/components/live/live-refresh";
import { ordersDealerChannel } from "@/lib/pusher/server-channels";
import "@/components/dealer/order-tracking.css";

function formatLitres(n: number) {
  return `${n.toLocaleString()} L`;
}

function formatLongDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function fuelSummaryLine(stationName: string, pms: number, ago: number) {
  const parts: string[] = [];
  if (pms > 0) parts.push(`${formatLitres(pms)} PMS`);
  if (ago > 0) parts.push(`${formatLitres(ago)} AGO`);
  if (parts.length === 0) parts.push("0 L");
  return `${stationName} Station · ${parts.join(" · ")}`;
}

function fuelOrderedLabel(pms: number, ago: number) {
  if (pms > 0 && ago > 0) {
    return `${formatLitres(pms)} PMS · ${formatLitres(ago)} AGO`;
  }
  if (pms > 0) return "PMS · Premium Motor Spirit";
  if (ago > 0) return "AGO · Automotive Gas Oil";
  return "No fuel lines";
}

function fuelOrderedVolume(pms: number, ago: number) {
  return formatLitres(pms + ago);
}

/** Headline + detail for the floating tracker card from live status. */
function trackerHeadline(status: DealerOrderStatus, steps: DealerTrackerStep[]) {
  const active = steps.find((s) => s.state === "active" || s.state === "attention");
  const label = dealerStatusLabel(status);

  switch (status) {
    case "SUBMITTED":
      return {
        title: "Order submitted",
        detail: "Your order has been received and is queued for commercial processing.",
      };
    case "ODOO_SYNC_PENDING":
    case "ODOO_SYNC_FAILED":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return {
        title: "Quotation in progress",
        detail: "Your order has been received and commercial processing is underway.",
      };
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
        detail: "Trinity finance couldn't verify your payment. Check the details below and submit them again.",
      };
    case "PAYMENT_CONFIRMED":
      return {
        title: "Payment confirmed",
        detail: "Payment is confirmed. Trinity will release this order to the depot shortly.",
      };
    case "RELEASED_TO_DEPOT":
      return {
        title: "Released to depot",
        detail: "Your order has been released to the depot and is waiting to enter the loading stage.",
      };
    case "LOADING":
      return {
        title: "Loading in progress",
        detail: "Your order has been released to the depot and is currently in the loading stage.",
      };
    case "LOADED":
      return {
        title: "Loaded",
        detail: "Fuel has been loaded and is preparing for dispatch to your station.",
      };
    case "DISPATCHED":
    case "IN_TRANSIT":
      return {
        title: "Your delivery is on the way",
        detail: "Your fuel order is in transit to the delivery station.",
      };
    case "DELIVERED":
    case "CLOSED":
      return {
        title: "Order delivered",
        detail: "Fuel has been delivered to your station.",
      };
    case "CANCELLED":
      return { title: "Order cancelled", detail: "This order was cancelled and will not progress further." };
    case "REJECTED":
      return { title: "Order rejected", detail: "This order was rejected and will not progress further." };
    case "STOCK_EXCEPTION":
    case "DELIVERY_EXCEPTION":
      return {
        title: label,
        detail: "Trinity is resolving an exception on this order. Check back shortly or contact support.",
      };
    case "REQUIRES_AMENDMENT":
      return {
        title: "Needs update",
        detail: "This order needs an amendment before Trinity can continue processing.",
      };
    default:
      return {
        title: active?.label ?? label,
        detail: "Track each stage of this order as Trinity processes it.",
      };
  }
}

function stageBadge(steps: DealerTrackerStep[], stopped: string | null) {
  if (stopped) return "Stopped";
  const activeIndex = steps.findIndex((s) => s.state === "active" || s.state === "attention");
  if (activeIndex >= 0) return `Stage ${activeIndex + 1} of ${steps.length}`;
  if (steps.every((s) => s.state === "done")) return `Stage ${steps.length} of ${steps.length}`;
  return `Stage — of ${steps.length}`;
}

function stepSecondary(item: DealerTrackerStep) {
  if (item.state === "done") return "Done";
  if (item.state === "pending") return "Pending";
  if (item.state === "stopped") return "—";
  return item.note ?? (item.state === "attention" ? "Needs attention" : "In progress");
}

/** Document badges follow the same tracker as the progress bar. */
function docState(
  kind: "quotation" | "pfi" | "payment" | "delivery",
  steps: DealerTrackerStep[],
  status: DealerOrderStatus,
  hasPfi: boolean,
) {
  const stateOf = (key: DealerTrackerStep["key"]) => steps.find((s) => s.key === key)?.state;
  if (kind === "quotation") {
    if (hasPfi || stateOf("quotation") === "done") return { label: "Ready", tone: "ready" as const };
    const quotation = stateOf("quotation");
    if (quotation === "active" || quotation === "attention") {
      return { label: "Processing", tone: "processing" as const };
    }
    return { label: "Pending", tone: "pending" as const };
  }
  if (kind === "pfi") {
    if (hasPfi) return { label: "Ready", tone: "ready" as const };
    return { label: "Pending", tone: "pending" as const };
  }
  if (kind === "payment") {
    if (stateOf("payment") === "done") return { label: "Ready", tone: "ready" as const };
    if (status === "AWAITING_PAYMENT" || status === "PFI_ISSUED") {
      return { label: "Action needed", tone: "processing" as const };
    }
    return { label: "Pending", tone: "pending" as const };
  }
  if (stateOf("delivered") === "done") return { label: "Ready", tone: "ready" as const };
  return { label: "Pending", tone: "pending" as const };
}

export default async function DealerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDealer();
  const { id } = await params;
  const orgId = session.user.dealerOrganizationId!;
  const [order, siblings] = await Promise.all([
    prisma.dealerOrder.findFirst({
      where: { id, dealerOrganizationId: orgId },
      include: { station: true, lines: true, proforma: true, payments: true },
    }),
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, station: { select: { name: true } } },
    }),
  ]);
  if (!order) notFound();

  const navOrders = siblings.map((item) => ({
    id: item.id,
    reference: item.reference,
    stationName: item.station.name,
  }));

  const tracker = dealerTrackerSteps(order.status);
  const pms = order.lines.find((l) => l.product === "PMS")?.quantityLitres ?? 0;
  const ago = order.lines.find((l) => l.product === "AGO")?.quantityLitres ?? 0;
  const headline = trackerHeadline(order.status, tracker.steps);
  const badgeLabel =
    order.status === "SUBMITTED" ? "Order Submitted" : dealerStatusLabel(order.status);
  const badgeTone =
    order.status === "CANCELLED" || order.status === "REJECTED"
      ? "danger"
      : order.status === "PAYMENT_EXCEPTION" ||
          order.status === "STOCK_EXCEPTION" ||
          order.status === "DELIVERY_EXCEPTION" ||
          order.status === "REQUIRES_AMENDMENT"
        ? "warn"
        : order.status === "AWAITING_PAYMENT" || order.status === "PFI_ISSUED"
          ? "warn"
          : order.status === "DELIVERED" || order.status === "CLOSED"
            ? "ok"
            : "ok";
  const stageLabel = stageBadge(tracker.steps, tracker.stopped);

  const docs = [
    {
      key: "quotation" as const,
      title: "Sales quotation",
      ...docState("quotation", tracker.steps, order.status, Boolean(order.proforma)),
    },
    {
      key: "pfi" as const,
      title: "Pro Forma Invoice (PFI)",
      ...docState("pfi", tracker.steps, order.status, Boolean(order.proforma)),
    },
    {
      key: "payment" as const,
      title: "Payment confirmation",
      ...docState("payment", tracker.steps, order.status, Boolean(order.proforma)),
    },
    {
      key: "delivery" as const,
      title: "Delivery note",
      ...docState("delivery", tracker.steps, order.status, Boolean(order.proforma)),
    },
  ];

  return (
    <div className="ot">
      <section className="ot__hero" style={dealerHeroPhotoStyle}>
        <div className="ot__hero-veil" aria-hidden />
        <div className="ot__hero-inner">
          <nav className="ot__crumbs" aria-label="Breadcrumb">
            <Link href="/dealer/orders" className="ot__crumb">
              Orders
            </Link>
            <ChevronRight className="ot__crumb-sep" size={14} strokeWidth={2.4} aria-hidden />
            <span className="ot__crumb is-current">Order tracking</span>
            <ChevronRight className="ot__crumb-sep" size={14} strokeWidth={2.4} aria-hidden />
            <span className="ot__crumb is-leaf">{order.reference}</span>
          </nav>

          <h1>{order.reference}</h1>
          <p className="ot__sub">{fuelSummaryLine(order.station.name, pms, ago)}</p>

          <div className="ot__hero-meta">
            <span className={`ot__status-pill is-${badgeTone}`}>{badgeLabel}</span>
            <span className="ot__submitted">Submitted {formatDateTime(order.createdAt)}</span>
            <LiveRefresh channel={ordersDealerChannel(orgId)} />
          </div>

          <DealerHeroActions showPay />
        </div>
      </section>

      <div className="ot__inner">
        <div className="ot__tracker-stack">
          <article className="ot__tracker">
            <header className="ot__tracker-head">
              <div className="ot__tracker-lead">
                <span className="ot__tracker-icon" aria-hidden>
                  <Truck size={22} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="ot__tracker-kicker">Current order status</div>
                  <h2>{headline.title}</h2>
                  <p>{headline.detail}</p>
                </div>
              </div>
              <span className="ot__stage-pill">{stageLabel}</span>
            </header>

            {tracker.stopped ? <p className="ot__stopped">{tracker.stopped}</p> : null}

            <ol
              className={`ot__progress ${tracker.stopped ? "is-stopped" : ""}`}
              aria-label="Order progress"
            >
              {tracker.steps.map((item, index) => {
                const next = tracker.steps[index + 1];
                const connectorClass =
                  item.state === "done"
                    ? next && next.state !== "done"
                      ? "is-active"
                      : "is-done"
                    : "";
                const isCurrent = item.state === "active" || item.state === "attention";
                return (
                  <li
                    key={item.key}
                    className={`ot__progress-step is-${item.state}`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <div className="ot__progress-rail">
                      <div className="ot__progress-node">
                        <span className="ot__progress-dot">
                          {item.state === "done" ? (
                            <Check size={14} strokeWidth={3} />
                          ) : item.state === "attention" ? (
                            "!"
                          ) : (
                            index + 1
                          )}
                        </span>
                        <em>{item.label}</em>
                        <small>{stepSecondary(item)}</small>
                      </div>
                      {index < tracker.steps.length - 1 ? (
                        <span className={`ot__progress-line ${connectorClass}`} aria-hidden />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        </div>

        <div className="ot__tools" aria-label="Browse other orders">
          <OrderTrackingNav orders={navOrders} currentId={order.id} />
        </div>

        <div className="ot__grid">
          <article className="ot__card">
            <header className="ot__card-head">
              <div className="ot__card-title">
                <span className="ot__card-icon" aria-hidden>
                  <FileText size={18} strokeWidth={2.2} />
                </span>
                <h2>Order details</h2>
              </div>
              <span className="ot__ref-pill">{order.reference}</span>
            </header>

            <div className="ot__summary-tiles">
              <div className="ot__tile is-fuel">
                <span className="ot__tile-icon" aria-hidden>
                  <Fuel size={18} strokeWidth={2.2} />
                </span>
                <div className="ot__tile-copy">
                  <span className="ot__tile-label">Fuel ordered</span>
                  <strong>{fuelOrderedVolume(pms, ago)}</strong>
                  <em>{fuelOrderedLabel(pms, ago)}</em>
                </div>
                <Droplets className="ot__tile-watermark" size={72} strokeWidth={1.2} aria-hidden />
              </div>

              <div className="ot__tile is-station">
                <span className="ot__tile-icon" aria-hidden>
                  <MapPin size={18} strokeWidth={2.2} />
                </span>
                <div className="ot__tile-copy">
                  <span className="ot__tile-label">Delivery station</span>
                  <strong>{order.station.name}</strong>
                  <em>Requested delivery: {formatLongDate(order.requestedDeliveryDate)}</em>
                </div>
                <Fuel className="ot__tile-watermark" size={72} strokeWidth={1.2} aria-hidden />
              </div>
            </div>

            {pms > 0 && ago > 0 ? (
              <div className="ot__product-split" aria-label="Product quantities">
                <div className="ot__product-chip is-pms">
                  <span>PMS</span>
                  <strong>{formatLitres(pms)}</strong>
                </div>
                <div className="ot__product-chip is-ago">
                  <span>AGO</span>
                  <strong>{formatLitres(ago)}</strong>
                </div>
              </div>
            ) : null}

            <ul className="ot__facts">
              <li>
                <span className="ot__fact-icon" aria-hidden>
                  <Calendar size={14} />
                </span>
                <span className="ot__fact-label">Order date</span>
                <strong>{formatDateTime(order.createdAt)}</strong>
              </li>
              <li>
                <span className="ot__fact-icon" aria-hidden>
                  <Tag size={14} />
                </span>
                <span className="ot__fact-label">Your reference</span>
                <strong>{order.dealerReference || "Not provided"}</strong>
              </li>
              <li>
                <span className="ot__fact-icon" aria-hidden>
                  <StickyNote size={14} />
                </span>
                <span className="ot__fact-label">Notes</span>
                <strong>{order.notes || "None"}</strong>
              </li>
            </ul>
          </article>

          <aside className="ot__side">
            <article className="ot__card">
              <header className="ot__card-head">
                <div className="ot__card-title">
                  <span className="ot__card-icon" aria-hidden>
                    <FileText size={18} strokeWidth={2.2} />
                  </span>
                  <h2>Documents</h2>
                </div>
              </header>

              <ul className="ot__docs">
                {docs.map((doc) => {
                  const isPfiReady = doc.key === "pfi" && Boolean(order.proforma);

                  return (
                    <li key={doc.key} className="ot__doc">
                      <span className="ot__doc-icon" aria-hidden>
                        <FileText size={16} strokeWidth={2.2} />
                      </span>
                      <div className="ot__doc-copy">
                        <strong>{doc.title}</strong>
                        {isPfiReady ? null : (
                          <em className={`ot__pill is-${doc.tone}`}>{doc.label}</em>
                        )}
                      </div>
                      {isPfiReady ? (
                        <a
                          className="ot__doc-action"
                          href={`/api/orders/${order.id}/pfi`}
                          target="_blank"
                          rel="noopener"
                        >
                          View PFI
                          <ExternalLink size={14} strokeWidth={2.2} aria-hidden />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="ot__doc-action is-disabled"
                          disabled
                          aria-disabled="true"
                          title={
                            doc.tone === "ready"
                              ? "Download will be available when the file is linked"
                              : "Document not available yet"
                          }
                        >
                          Download
                          <Download size={14} strokeWidth={2.2} aria-hidden />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          </aside>
        </div>
      </div>
    </div>
  );
}
