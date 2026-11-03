import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  dealerStatusLabel,
  dealerTrackerSteps,
  type DealerTrackerStep,
} from "@/lib/orders/state-machine";
import { PaymentForm } from "@/components/dealer/payment-form";
import { OrderTrackingNav } from "@/components/dealer/order-tracking-nav";
import { docState, statusCopy } from "@/lib/orders/dealer-order-copy";
import { PageHead } from "@/components/layout/page-head";
import { StatusChip } from "@/components/ui/status-chip";
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

const DOC_CHIP = { ready: "done", processing: "trinity", action: "dealer", pending: "muted" } as const;

const STEP_STATUS_TEXT: Record<DealerTrackerStep["state"], string> = {
  done: "Done",
  active: "In progress",
  attention: "Needs attention",
  pending: "Pending",
  stopped: "—",
};

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
  const canPay = order.status === "AWAITING_PAYMENT" || order.status === "PAYMENT_EXCEPTION";
  const pms = order.lines.find((l) => l.product === "PMS")?.quantityLitres ?? 0;
  const ago = order.lines.find((l) => l.product === "AGO")?.quantityLitres ?? 0;
  const total = pms + ago;
  const current = statusCopy(order.status);

  const docs = [
    {
      key: "quotation",
      title: "Sales quotation",
      ...docState("quotation", tracker.steps, order.status, Boolean(order.proforma)),
    },
    {
      key: "pfi",
      title: "Pro Forma Invoice (PFI)",
      ...docState("pfi", tracker.steps, order.status, Boolean(order.proforma)),
    },
    {
      key: "payment",
      title: "Payment confirmation",
      ...docState("payment", tracker.steps, order.status, Boolean(order.proforma)),
    },
    {
      key: "delivery",
      title: "Delivery note",
      ...docState("delivery", tracker.steps, order.status, Boolean(order.proforma)),
    },
  ];

  const litres = [
    pms > 0 ? { product: "PMS", name: "Premium motor spirit", litres: pms } : null,
    ago > 0 ? { product: "AGO", name: "Automotive gas oil", litres: ago } : null,
  ].filter((l) => l !== null);

  return (
    <div className="ui-page ot">
      <PageHead
        back={{ href: "/dealer/orders", label: "Orders" }}
        title={order.reference}
        aside={<StatusChip status={order.status} label={dealerStatusLabel(order.status)} />}
        description={`${order.station.name} · ${formatLitres(total)} · submitted ${formatDateTime(order.createdAt)}`}
        action={<OrderTrackingNav orders={navOrders} currentId={order.id} />}
      />

      <section className="ui-panel ot-track" aria-labelledby="ot-track-title">
        <h2 id="ot-track-title" className="ui-section-title">
          {current.label}
        </h2>
        <p className="ot-track__detail">{current.detail}</p>
        {tracker.stopped ? <p className="ot-track__stopped">{tracker.stopped}</p> : null}
        <ol className={`ot-steps${tracker.stopped ? " is-stopped" : ""}`} aria-label="Order progress">
          {tracker.steps.map((item, index) => (
            <li
              key={item.key}
              className={`ot-step is-${item.state}`}
              aria-current={item.state === "active" || item.state === "attention" ? "step" : undefined}
            >
              <span className="ot-step__dot" aria-hidden>
                {item.state === "done" ? <Check size={14} strokeWidth={3} /> : item.state === "attention" ? "!" : index + 1}
              </span>
              <span className="ot-step__text">
                <b>{item.label}</b>
                <span>{item.note ?? STEP_STATUS_TEXT[item.state]}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="ot-body">
        <section className="ui-panel" aria-labelledby="ot-details-title">
          <h2 id="ot-details-title" className="ui-section-title">
            Order details
          </h2>
          <dl className="ot-facts">
            {litres.map((l) => (
              <div key={l.product}>
                <dt>
                  {l.product} <span>{l.name}</span>
                </dt>
                <dd>{formatLitres(l.litres)}</dd>
              </div>
            ))}
            <div className="ot-facts__total">
              <dt>Total</dt>
              <dd>{formatLitres(total)}</dd>
            </div>
            <div>
              <dt>Station</dt>
              <dd>{order.station.name}</dd>
            </div>
            <div>
              <dt>Requested delivery</dt>
              <dd>{formatLongDate(order.requestedDeliveryDate)}</dd>
            </div>
            <div>
              <dt>Order date</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div>
              <dt>Your reference</dt>
              <dd>{order.dealerReference || "Not provided"}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{order.notes || "None"}</dd>
            </div>
          </dl>
        </section>

        <aside className="ot-side">
          <section className="ui-panel" aria-labelledby="ot-docs-title">
            <h2 id="ot-docs-title" className="ui-section-title">
              Documents
            </h2>
            <ul className="ot-docs">
              {docs.map((doc) => (
                <li key={doc.key}>
                  <span>{doc.title}</span>
                  {doc.key === "pfi" && order.proforma ? (
                    <a className="ui-navlink" href={`/api/orders/${order.id}/pfi`} target="_blank" rel="noopener">
                      View PFI
                    </a>
                  ) : (
                    <span className={`ui-chip ui-chip--${DOC_CHIP[doc.tone]}`}>{doc.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {canPay ? <PaymentForm orderId={order.id} amountDue={order.amountDue ?? null} /> : null}
        </aside>
      </div>
    </div>
  );
}
