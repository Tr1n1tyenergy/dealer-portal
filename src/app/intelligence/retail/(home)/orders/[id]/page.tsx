import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ClipboardList,
  FileText,
  Fuel,
  Landmark,
  Layers,
  Lock,
  MapPin,
  RefreshCw,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/session";
import { internalOrderAction } from "@/lib/orders/actions";
import { formatKes, sameAmount } from "@/lib/orders/money";
import { stageOf, statusLabel } from "@/lib/orders/stages";
import { paymentSummary, stepCompletionTimes } from "@/lib/orders/staff-views";
import { dealerTrackerSteps, trackerStepSecondary } from "@/lib/orders/state-machine";
import { StaffOrderDetailGrid } from "@/components/staff/staff-order-bottom-row";
import "@/app/intelligence/retail/staff-orders.css";

export const maxDuration = 60;

const when = (at: Date | null | undefined, withTime = true) =>
  at
    ? at.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Africa/Nairobi",
      })
    : null;

/** "2 Nov, 15:01" — short enough for tracker columns. */
const shortWhen = (at: Date | null | undefined) =>
  at
    ? at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })
    : null;

export default async function StaffOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");
  const mayAct = canUser(session.user, "orders", "act");

  const { id } = await params;
  const order = await prisma.dealerOrder.findUnique({
    where: { id },
    include: {
      dealerOrganization: { select: { name: true, users: { where: { status: "ACTIVE" }, select: { email: true }, take: 1 } } },
      station: { select: { name: true, tradingName: true } },
      depot: { select: { name: true } },
      lines: true,
      proforma: true,
      payments: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      history: { orderBy: { createdAt: "desc" }, include: { actor: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!order) notFound();

  const tracker = dealerTrackerSteps(order.status);
  const stepTimes = stepCompletionTimes(order.history);
  const currentStep = tracker.steps.findIndex((s) => s.state === "active" || s.state === "attention");
  const stageNumber = currentStep === -1 ? tracker.steps.length : currentStep + 1;
  const litres = order.lines.reduce((sum, line) => sum + line.quantityLitres, 0);
  const byProduct = order.lines.map((line) => `${line.quantityLitres.toLocaleString("en-US")} L ${line.product}`).join(" · ");
  const pay = paymentSummary(order.proforma?.amount ?? order.amountDue, order.payments);
  const openPayments = order.payments.filter((p) => p.status === "SUBMITTED" || p.status === "VERIFICATION");
  const contact = order.dealerOrganization.users[0] ?? null;
  const depots = mayAct && order.status === "PAYMENT_CONFIRMED" ? await prisma.depot.findMany({ orderBy: { name: "asc" } }) : [];
  const actorName = (actor: { firstName: string | null; lastName: string | null } | null) =>
    actor ? [actor.firstName, actor.lastName].filter(Boolean).join(" ") || "Staff" : "System";

  return (
    <div className="so">
      <header className="so-hero" aria-label="Order details hero">
        <div className="so-hero__text">
          <div className="so-hero__crumbs">
            <Link href="/intelligence/retail/orders">Orders</Link> › Order Details
          </div>
          <div className="so-hero__title-row">
            <h1>{order.reference}</h1>
            <span className={`so-pill so-pill--${stageOf(order.status)}`}>{statusLabel(order.status)}</span>
          </div>
          <div className="so-hero__meta">
            <span><Building2 size={14} /> {order.dealerOrganization.name}</span>
            <span><MapPin size={14} /> {order.station.tradingName || order.station.name}</span>
            <span><Calendar size={14} /> Order date: {when(order.createdAt)}</span>
          </div>
        </div>
      </header>

      <div className="so-wrap">
        <div className="sod-layout">
          <div className="sod-top">
            <section className="so-card sod-track-card">
              <div className="so-card__head">
                <span className="so-ico"><Truck size={15} /></span>
                <span id="tracking">Order Tracking</span>
                <span className="so-spacer sod-stagebadge">
                  {tracker.stopped ? "Stopped" : `Stage ${Math.min(stageNumber, tracker.steps.length)} of ${tracker.steps.length}`}
                </span>
              </div>
              {tracker.stopped ? <div className="so-track__stopped">{tracker.stopped}</div> : null}
              <ol
                className={`so-progress so-progress--detail${tracker.stopped ? " is-stopped" : ""}`}
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
                  const note =
                    step.state === "done"
                      ? shortWhen(stepTimes[index]) ?? "Done"
                      : trackerStepSecondary(step);
                  return (
                    <li
                      key={step.key}
                      className={`so-progress__step is-${step.state}`}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <div className="so-progress__rail">
                        <div className="so-progress__node">
                          <span className="so-progress__dot">
                            {step.state === "done" ? (
                              <Check size={14} strokeWidth={3} />
                            ) : step.state === "attention" ? (
                              "!"
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="so-progress__label">{step.label}</span>
                          <small className="so-progress__note">{note}</small>
                        </div>
                        {index < tracker.steps.length - 1 ? (
                          <span className={`so-progress__line ${connectorClass}`} aria-hidden />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="so-card sod-actions-card">
              <div className="so-card__head"><span className="so-ico"><Zap size={15} /></span> Staff Actions</div>
              <div className="sod-actions">
                {!mayAct ? <p className="so-preview__hint" style={{ margin: 0 }}>Your role can view this order but not act on it.</p> : null}

                {mayAct && (order.status === "ODOO_SYNC_FAILED" || order.status === "ODOO_SYNC_PENDING") ? (
                  <div className="sod-action sod-action--ready">
                    <div className="sod-action__title"><RefreshCw size={15} /> Retry Odoo sync</div>
                    {order.odooSyncError ? <div className="sod-action__sub">Last attempt: {order.odooSyncError}</div> : null}
                    <form action={internalOrderAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="so-btn so-btn--gold" name="action" value="retry-sync">Retry sync</button>
                    </form>
                  </div>
                ) : null}

                {mayAct && (order.status === "QUOTATION_READY" || order.status === "PFI_PENDING" || order.status === "PFI_ISSUED") ? (
                  <div className="sod-action sod-action--ready">
                    <div className="sod-action__title"><FileText size={15} /> {order.status === "PFI_ISSUED" ? "Finish PFI" : "Generate PFI"}</div>
                    <div className="sod-action__sub">Issue the pro forma invoice so the dealer can pay.</div>
                    <form action={internalOrderAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="so-btn so-btn--gold" name="action" value="generate-pfi">
                        {order.status === "PFI_ISSUED" ? "Finish PFI" : "Generate PFI"}
                      </button>
                    </form>
                  </div>
                ) : null}

                {mayAct && (order.status === "PAYMENT_SUBMITTED" || order.status === "PAYMENT_VERIFICATION") ? (
                  <div className="sod-action sod-action--ready">
                    <div className="sod-action__title">
                      <Landmark size={15} /> Confirm Payment
                      <span className="sod-action__go" aria-hidden><ArrowRight size={14} strokeWidth={2.4} /></span>
                    </div>
                    <div className="sod-action__sub">Verify the dealer&apos;s payment against the PFI before confirming.</div>
                    {openPayments.length === 0 ? <div className="sod-action__sub">No payment record was submitted.</div> : null}
                    {openPayments.map((payment) => (
                      <div key={payment.id} className="sod-pay">
                        <span className="sod-pay__amount">
                          {formatKes(payment.amount)}
                          {order.proforma && !sameAmount(payment.amount, order.proforma.amount) ? (
                            <span className="sod-pay__mismatch"> — does not match PFI {formatKes(order.proforma.amount)}</span>
                          ) : null}
                        </span>
                        <span className="sod-pay__meta">
                          {[
                            payment.bankReference ? `Bank ref: ${payment.bankReference}` : null,
                            payment.transactionReference ? `Txn: ${payment.transactionReference}` : null,
                            payment.paymentDate ? `Paid: ${when(payment.paymentDate, false)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No references provided"}
                        </span>
                        {payment.note ? <span className="sod-pay__meta">Dealer note: {payment.note}</span> : null}
                      </div>
                    ))}
                    <form action={internalOrderAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="text" name="note" maxLength={300} placeholder="Note (optional)" aria-label="Verification note" />
                      <button className="so-btn so-btn--gold" name="action" value="confirm-payment">Confirm payment</button>
                      <button className="so-btn so-btn--warn" name="action" value="reject-payment">Flag exception</button>
                    </form>
                  </div>
                ) : null}

                {mayAct && order.status === "PAYMENT_CONFIRMED" ? (
                  <div className="sod-action sod-action--ready">
                    <div className="sod-action__title">
                      <Warehouse size={15} /> Release to Depot
                      <span className="sod-action__go" aria-hidden><ArrowRight size={14} strokeWidth={2.4} /></span>
                    </div>
                    <div className="sod-action__sub">Payment confirmed — choose the depot that will load this order.</div>
                    <form action={internalOrderAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <select name="depotId" defaultValue={depots[0]?.id} aria-label="Depot">
                        {depots.map((depot) => (
                          <option key={depot.id} value={depot.id}>{depot.name}</option>
                        ))}
                      </select>
                      <button className="so-btn so-btn--blue" name="action" value="release">Release to depot</button>
                    </form>
                  </div>
                ) : null}

                {mayAct && !tracker.stopped && stageNumber <= 3 && order.status !== "PAYMENT_CONFIRMED" && !(order.status === "PAYMENT_SUBMITTED" || order.status === "PAYMENT_VERIFICATION") ? (
                  <div className="sod-action sod-action--ready">
                    <span className="sod-action__ico" aria-hidden><Landmark size={16} strokeWidth={1.9} /></span>
                    <div className="sod-action__copy">
                      <div className="sod-action__title">Confirm Payment</div>
                      <div className="sod-action__sub">Available once the dealer submits payment details.</div>
                    </div>
                    <span className="sod-action__go" aria-hidden><ArrowRight size={14} strokeWidth={2.4} /></span>
                  </div>
                ) : null}
                {mayAct && !tracker.stopped && stageNumber <= 3 ? (
                  <div className="sod-action sod-action--locked">
                    <span className="sod-action__ico" aria-hidden><Warehouse size={16} strokeWidth={1.9} /></span>
                    <div className="sod-action__copy">
                      <div className="sod-action__title">Release to Depot</div>
                      <div className="sod-action__sub">Available after payment confirmation.</div>
                    </div>
                    <span className="sod-action__go" aria-hidden><Lock size={13} strokeWidth={2.2} /></span>
                  </div>
                ) : null}
                {mayAct && stageNumber > 3 && !tracker.stopped ? (
                  <p className="so-preview__hint" style={{ margin: 0 }}>
                    This order is with the depot — loading, dispatch and delivery are recorded on the Depot Portal.
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          <StaffOrderDetailGrid
            main={
              <>
                <div className="sod-row2">
                  <section className="so-card sod-details-card">
                    <div className="so-card__head"><span className="so-ico"><ClipboardList size={15} /></span> Order Details</div>
                    <div className="sod-fuel">
                      <span className="so-ico" style={{ width: 40, height: 40 }}><Fuel size={20} /></span>
                      <div>
                        <div className="so-cell-sub">Fuel Ordered</div>
                        <div className="sod-fuel__litres">{litres.toLocaleString("en-US")} L</div>
                        <div className="sod-fuel__split">{byProduct || "No fuel lines"}</div>
                      </div>
                    </div>
                    <dl className="sod-kv">
                      <div><dt>Order date</dt><dd>{when(order.createdAt)}</dd></div>
                      <div><dt>Requested delivery</dt><dd>{when(order.requestedDeliveryDate, false) ?? "Not provided"}</dd></div>
                    </dl>
                  </section>

                  <section className="so-card sod-party-card">
                    <div className="so-card__head"><span className="so-ico"><Building2 size={15} /></span> Dealer &amp; Station Details</div>
                    <dl className="sod-kv sod-kv--roomy">
                      <div><dt>Dealer</dt><dd>{order.dealerOrganization.name}</dd></div>
                      <div><dt>Station</dt><dd>{order.station.tradingName || order.station.name}</dd></div>
                      <div><dt>Email</dt><dd>{contact?.email || "Not provided"}</dd></div>
                      <div><dt>Depot</dt><dd>{order.depot?.name ?? "Not assigned"}</dd></div>
                      {order.truckRegistration ? <div><dt>Truck</dt><dd>{order.truckRegistration}</dd></div> : null}
                      {order.driverName ? <div><dt>Driver</dt><dd>{order.driverName}</dd></div> : null}
                    </dl>
                  </section>
                </div>

                <section className="so-card sod-pay-card">
                  <div className="so-card__head"><span className="so-ico"><Layers size={15} /></span> Payment Summary</div>
                  <div className="sod-summary">
                    <div className="sod-summary__cell">
                      <div className="sod-summary__label">Amount Paid</div>
                      <div className="sod-summary__value">{formatKes(pay.paid)}</div>
                    </div>
                    <div className="sod-summary__cell">
                      <div className="sod-summary__label">Amount Due</div>
                      <div className="sod-summary__value">{pay.due == null ? "—" : formatKes(pay.due)}</div>
                    </div>
                    <div className="sod-summary__cell">
                      <div className="sod-summary__label">Order Total</div>
                      <div className="sod-summary__value">{formatKes(order.proforma?.amount ?? order.amountDue)}</div>
                    </div>
                  </div>
                </section>
              </>
            }
            side={
              <>
                <section className="so-card sod-docs-card">
                  <div className="so-card__head"><span className="so-ico"><FileText size={15} /></span> Documents</div>
                  <div className="sod-docs">
                    <div className="sod-doc">
                      <span className="so-ico"><FileText size={14} /></span>
                      <div>
                        <div className="sod-doc__name">Sales quotation</div>
                        <div className="sod-doc__sub">{order.odooQuotationNumber ? `${order.odooQuotationNumber} · in Odoo` : "Not created yet"}</div>
                      </div>
                      {order.odooQuotationNumber ? <span className="so-pill so-pill--complete" style={{ marginLeft: "auto" }}>Ready</span> : null}
                    </div>
                    <div className="sod-doc">
                      <span className="so-ico"><FileText size={14} /></span>
                      <div>
                        <div className="sod-doc__name">Pro Forma Invoice (PFI)</div>
                        <div className="sod-doc__sub">{order.proforma ? `${order.proforma.number} · issued ${when(order.proforma.issuedAt, false)}` : "Not issued yet"}</div>
                      </div>
                      {order.proforma ? (
                        <a className="sod-doc__act" href={`/api/orders/${order.id}/pfi`} target="_blank" rel="noopener">View PFI ↗</a>
                      ) : null}
                    </div>
                    {order.payments.map((payment) => (
                      <div className="sod-doc" key={payment.id}>
                        <span className="so-ico"><Landmark size={14} /></span>
                        <div>
                          <div className="sod-doc__name">Payment record · {formatKes(payment.amount)}</div>
                          <div className="sod-doc__sub">
                            {statusLabel(payment.status)} · {when(payment.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {order.documents.map((doc) => (
                      <div className="sod-doc" key={doc.id}>
                        <span className="so-ico"><FileText size={14} /></span>
                        <div>
                          <div className="sod-doc__name">{doc.fileName}</div>
                          <div className="sod-doc__sub">{doc.kind} · {when(doc.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="so-card sod-activity-card">
                  <div className="so-card__head"><span className="so-ico"><Calendar size={15} /></span> Order Activity</div>
                  <div className="sod-activity">
                    {order.history.map((event) => (
                      <div className="sod-event" key={event.id}>
                        <span className={`sod-event__dot${event.actorId ? "" : " sod-event__dot--note"}`} />
                        <div>
                          <div className="sod-event__title">{event.note || `${statusLabel(event.toStatus)}`}</div>
                          <div className="sod-event__meta">
                            {statusLabel(event.toStatus)} · {when(event.createdAt)} · by {actorName(event.actor)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {order.history.length === 0 ? <p className="so-preview__hint">No activity recorded yet.</p> : null}
                  </div>
                </section>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
