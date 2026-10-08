import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Download,
  Droplets,
  FileText,
  Fuel,
  Home,
  MapPin,
  Package,
} from "lucide-react";
import type { DealerOrderStatus } from "@prisma/client";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dealerProgressIndex, dealerStatusLabel } from "@/lib/orders/state-machine";
import { paymentAction } from "@/lib/orders/actions";
import { OrderTrackingNav } from "@/components/dealer/order-tracking-nav";
import "@/components/dealer/order-tracking.css";

const TRACK_STEPS = [
  "Order Submitted",
  "Quotation Processing",
  "PFI",
  "Payment",
  "Depot Release",
  "Loading",
  "Dispatch",
  "In Transit",
  "Delivered",
] as const;

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

function stationArea(name: string) {
  if (name.toLowerCase().includes("nakuru")) return "Nakuru";
  if (name.toLowerCase().includes("westlands")) return "Nairobi";
  return "Kenya";
}

function statusCopy(status: DealerOrderStatus) {
  const label = dealerStatusLabel(status);
  switch (status) {
    case "SUBMITTED":
      return {
        label,
        detail: "Your order has been received and is queued for commercial processing.",
      };
    case "ODOO_SYNC_PENDING":
    case "ODOO_SYNC_FAILED":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return {
        label: "Quotation Processing",
        detail: "Your order has been received and commercial processing is underway.",
      };
    case "PFI_ISSUED":
    case "AWAITING_PAYMENT":
      return {
        label,
        detail: "Your Pro Forma Invoice is ready. Complete payment to release the order to depot.",
      };
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
      return {
        label,
        detail: "Payment details have been received and are being verified by Trinity finance.",
      };
    case "DELIVERED":
    case "CLOSED":
      return {
        label,
        detail: "Fuel has been delivered to your station.",
      };
    default:
      return {
        label,
        detail: "Track each stage of this order as Trinity processes it.",
      };
  }
}

function docState(
  kind: "quotation" | "pfi" | "payment" | "delivery",
  status: DealerOrderStatus,
  hasPfi: boolean,
  hasPayment: boolean,
) {
  const step = dealerProgressIndex(status);
  if (kind === "quotation") {
    if (step >= 2 || hasPfi) return { label: "Ready", tone: "ready" as const };
    if (step >= 1 || status === "SUBMITTED") return { label: "Processing", tone: "processing" as const };
    return { label: "Pending", tone: "pending" as const };
  }
  if (kind === "pfi") {
    if (hasPfi || step >= 2) return { label: "Ready", tone: "ready" as const };
    return { label: "Pending", tone: "pending" as const };
  }
  if (kind === "payment") {
    if (hasPayment || step >= 3) return { label: "Ready", tone: "ready" as const };
    if (status === "AWAITING_PAYMENT" || status === "PFI_ISSUED") {
      return { label: "Action needed", tone: "processing" as const };
    }
    return { label: "Pending", tone: "pending" as const };
  }
  if (step >= 8) return { label: "Ready", tone: "ready" as const };
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

  const step = dealerProgressIndex(order.status);
  const canPay = order.status === "AWAITING_PAYMENT" || order.status === "PAYMENT_EXCEPTION";
  const pms = order.lines.find((l) => l.product === "PMS")?.quantityLitres ?? 0;
  const ago = order.lines.find((l) => l.product === "AGO")?.quantityLitres ?? 0;
  const total = pms + ago;
  const current = statusCopy(order.status);
  const badgeLabel =
    order.status === "SUBMITTED" ? "Order Submitted" : dealerStatusLabel(order.status);

  const docs = [
    {
      key: "quotation",
      title: "Sales Quotation",
      ...docState("quotation", order.status, Boolean(order.proforma), order.payments.length > 0),
    },
    {
      key: "pfi",
      title: "Pro Forma Invoice (PFI)",
      ...docState("pfi", order.status, Boolean(order.proforma), order.payments.length > 0),
    },
    {
      key: "payment",
      title: "Payment Confirmation",
      ...docState("payment", order.status, Boolean(order.proforma), order.payments.length > 0),
    },
    {
      key: "delivery",
      title: "Delivery Note",
      ...docState("delivery", order.status, Boolean(order.proforma), order.payments.length > 0),
    },
  ];

  return (
    <div className="dp-dash">
      <section
        className="dp-hero dp-ot-hero"
        style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
      >
        <div className="dp-hero__veil" />
        <div className="dp-ot-hero__inner">
          <nav className="dp-po-crumb" aria-label="Breadcrumb">
            <Link href="/dealer/dashboard" aria-label="Home">
              <Home size={14} />
            </Link>
            <span className="sep">/</span>
            <span className="is-current">My Orders</span>
            <span className="sep">/</span>
            <span className="is-current">{order.reference}</span>
          </nav>

          <div className="dp-ot-toolbar">
            <Link href="/dealer/dashboard" className="dp-ot-back">
              <ArrowLeft size={14} />
              Back to Dashboard
            </Link>
            <OrderTrackingNav orders={navOrders} currentId={order.id} />
          </div>

          <div className="dp-ot-hero__grid">
            <div className="dp-ot-hero__copy">
              <div className="dp-ot-ref-row">
                <span className="dp-ot-ref">{order.reference}</span>
                <span className="dp-ot-badge">{badgeLabel}</span>
              </div>
              <h1>{order.station.name}</h1>
              <p className="dp-ot-volume">{formatLitres(total)} Fuel Order</p>
              <div className="dp-ot-meta">
                <span>
                  <Calendar size={14} />
                  Submitted: {formatDateTime(order.createdAt)}
                </span>
                <span>
                  <Calendar size={14} />
                  Requested Delivery: {formatLongDate(order.requestedDeliveryDate)}
                </span>
                <span>
                  <FileText size={14} />
                  Dealer Reference: {order.dealerReference || "—"}
                </span>
              </div>
            </div>

            <aside className="dp-ot-status">
              <div className="dp-ot-status__icon">
                <FileText size={18} />
              </div>
              <div>
                <div className="dp-ot-status__kicker">Current status</div>
                <strong>{current.label}</strong>
                <p>{current.detail}</p>
              </div>
            </aside>
          </div>

          <div className="dp-ot-progress-wrap">
            <div className="dp-ot-progress" aria-label="Order progress">
              {TRACK_STEPS.map((label, index) => {
                const isDone = step > index;
                const isActive = step === index;
                const connectorClass =
                  step > index ? "is-done" : step === index ? "is-active" : "";
                return (
                  <div
                    key={label}
                    className={`dp-ot-progress__step ${isDone ? "is-done" : ""} ${isActive ? "is-active" : ""}`}
                  >
                    <div className="dp-ot-progress__rail">
                      <div className="dp-ot-progress__node">
                        <span className="dp-ot-progress__dot">
                          {isDone ? <Check size={14} strokeWidth={3} /> : index + 1}
                        </span>
                        <em>{label}</em>
                        <small>{isDone ? "Done" : isActive ? "In Progress" : "Pending"}</small>
                      </div>
                      {index < TRACK_STEPS.length - 1 ? (
                        <span className={`dp-ot-progress__line ${connectorClass}`} aria-hidden />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="dp-body dp-ot-body">
        <div className="dp-ot-layout">
          <article className="dp-ot-card">
            <header className="dp-ot-card__head">
              <div className="dp-ot-card__title">
                <span className="dp-ot-card__icon is-blue">
                  <Fuel size={18} />
                </span>
                <div>
                  <h2>Order Details</h2>
                  <p>Fuel products, station and delivery information.</p>
                </div>
              </div>
              <button type="button" className="dp-ot-download" disabled title="Coming soon">
                <Download size={14} />
                Download Summary
              </button>
            </header>

            <div className="dp-ot-products">
              {pms > 0 ? (
                <div className="dp-ot-product is-pms">
                  <span className="dp-ot-product__icon">
                    <Droplets size={18} />
                  </span>
                  <div>
                    <strong>PMS</strong>
                    <em>Premium Motor Spirit</em>
                  </div>
                  <b>{formatLitres(pms)}</b>
                </div>
              ) : null}
              {ago > 0 ? (
                <div className="dp-ot-product is-ago">
                  <span className="dp-ot-product__icon">
                    <Fuel size={18} />
                  </span>
                  <div>
                    <strong>AGO</strong>
                    <em>Automotive Gas Oil</em>
                  </div>
                  <b>{formatLitres(ago)}</b>
                </div>
              ) : null}
            </div>

            <div className="dp-ot-total">
              <span>Total Order Volume</span>
              <strong>{formatLitres(total)}</strong>
            </div>

            <div className="dp-ot-facts">
              <div>
                <span>
                  <MapPin size={14} /> Station
                </span>
                <strong>{order.station.name}</strong>
                <em>
                  {stationArea(order.station.name)} · Active Station
                </em>
              </div>
              <div>
                <span>
                  <Calendar size={14} /> Requested Delivery Date
                </span>
                <strong>{formatLongDate(order.requestedDeliveryDate)}</strong>
              </div>
              <div>
                <span>
                  <Calendar size={14} /> Order Date
                </span>
                <strong>{formatDateTime(order.createdAt)}</strong>
              </div>
            </div>

            <div className="dp-ot-extras">
              <div>
                <span>
                  <FileText size={14} /> Dealer Reference / PO Number
                </span>
                <strong>{order.dealerReference || "Not provided"}</strong>
              </div>
              <div>
                <span>
                  <Package size={14} /> Order Notes
                </span>
                <strong>{order.notes || "No additional notes"}</strong>
              </div>
            </div>
          </article>

          <aside className="dp-ot-side">
            <article className="dp-ot-card">
              <header className="dp-ot-card__head">
                <div className="dp-ot-card__title">
                  <span className="dp-ot-card__icon is-blue">
                    <FileText size={18} />
                  </span>
                  <div>
                    <h2>Order Documents</h2>
                    <p>Access all documents related to this order.</p>
                  </div>
                </div>
              </header>

              <ul className="dp-ot-docs">
                {docs.map((doc) => (
                  <li key={doc.key}>
                    <span className="dp-ot-docs__icon">
                      <FileText size={16} />
                    </span>
                    <div>
                      <strong>{doc.title}</strong>
                      <em className={`dp-ot-pill is-${doc.tone}`}>{doc.label}</em>
                    </div>
                    <ChevronRight size={16} className="dp-ot-docs__chev" />
                  </li>
                ))}
              </ul>
            </article>

            {canPay ? (
              <form action={paymentAction} className="dp-ot-card dp-ot-pay">
                <input type="hidden" name="orderId" value={order.id} />
                <h3>Submit payment details</h3>
                <label>
                  Amount
                  <input name="amount" required defaultValue={order.amountDue ?? ""} />
                </label>
                <label>
                  Bank reference
                  <input name="bankReference" />
                </label>
                <label>
                  Transaction reference
                  <input name="transactionReference" />
                </label>
                <label>
                  Payment date
                  <input name="paymentDate" type="date" />
                </label>
                <label>
                  Note
                  <textarea name="note" rows={2} />
                </label>
                <button type="submit">Submit payment</button>
              </form>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
