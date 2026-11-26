import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Building2,
  Calendar,
  Check,
  ClipboardList,
  FileText,
  Fuel,
  Landmark,
  Layers,
  MapPin,
  Truck,
  Zap,
} from "lucide-react";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/session";
import { formatKes } from "@/lib/orders/money";
import { bankAccountByNumber, centsToAmount, paymentTotals } from "@/lib/orders/payments";
import { odooPaymentsEnabled } from "@/lib/integrations/odoo/config";
import { stageOf, statusLabel } from "@/lib/orders/stages";
import { paymentSummary, stepCompletionTimes } from "@/lib/orders/staff-views";
import { dealerTrackerSteps, trackerStepSecondary } from "@/lib/orders/state-machine";
import { StaffOrderDetailGrid } from "@/components/staff/staff-order-bottom-row";
import { StaffOrderActions, type StaffWaitingPayment } from "@/components/staff/staff-order-actions";
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
/** The Odoo line on a waiting payment in the Confirm Payment card. */
function odooLine(
  payment: {
    method: string;
    odooState: string | null;
    odooError: string | null;
    odooPaymentId: number | null;
    bankAccountNumber: string | null;
  },
  odooOn: boolean,
  bank: string | undefined
) {
  if (payment.odooError) return `Odoo: ${payment.odooError}`;
  if (payment.method === "MPESA_CODE") return "Already posted in Odoo (M-PESA). Confirming links it, no new entry.";
  if (!odooOn) return "Odoo payments are off: Accounts records this in Odoo.";
  if (!payment.bankAccountNumber) return "Sent before Odoo payments: confirming is portal-only.";
  if (payment.odooPaymentId == null) return "Sent while Odoo payments were off: confirming is portal-only.";
  if (payment.odooState === "draft") return `Draft created in Odoo · ${bank ?? "bank"} journal · Manual`;
  return "Not in Odoo yet.";
}

const shortWhen = (at: Date | null | undefined) =>
  at
    ? at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })
    : null;

export default async function StaffOrderDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paymentConfirmed?: string; amount?: string; odoo?: string }>;
}) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");
  const mayAct = canUser(session.user, "orders", "act");

  const { id } = await params;
  const confirmedNotice = await searchParams;
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
  const totals = paymentTotals(order.proforma?.amount ?? order.amountDue, order.payments);
  const outstanding = totals.balanceCents == null ? "—" : formatKes(centsToAmount(totals.balanceCents));
  const openPayments = order.payments
    .filter((p) => p.status === "SUBMITTED" || p.status === "VERIFICATION")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const odooPayments = odooPaymentsEnabled();
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
          {confirmedNotice.paymentConfirmed === "odoo" || confirmedNotice.paymentConfirmed === "portal" ? (
            <p className="spr-notice" role="status">
              {confirmedNotice.paymentConfirmed === "odoo"
                ? `Payment receipted${confirmedNotice.amount ? ` · ${confirmedNotice.amount}` : ""}${confirmedNotice.odoo ? ` · Odoo payment ${confirmedNotice.odoo}` : ""}. Outstanding ${outstanding}.`
                : `Payment confirmed in Trinity${confirmedNotice.amount ? ` · ${confirmedNotice.amount}` : ""}. Automatic receipting is off, so this was not posted to Odoo. Outstanding ${outstanding}.`}
            </p>
          ) : null}
          <div className="sod-top">
            <section className="so-card sod-track-card">
              <div className="so-card__head">
                <span className="so-ico"><Truck size={15} strokeWidth={1.75} /></span>
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
              <div className="so-card__head"><span className="so-ico"><Zap size={15} strokeWidth={1.75} /></span> Staff Actions</div>
              <StaffOrderActions
                orderId={order.id}
                mayAct={mayAct}
                waiting={openPayments.map((payment): StaffWaitingPayment => {
                  const account = bankAccountByNumber(payment.bankAccountNumber);
                  const manual = payment.method !== "MPESA_CODE";
                  return {
                    id: payment.id,
                    amountLabel: formatKes(payment.amount),
                    methodLabel: manual ? "Manual" : "M-PESA",
                    methodKind: manual ? "manual" : "mpesa",
                    accountLabel: manual ? "Account" : "M-PESA code",
                    accountValue: manual
                      ? account
                        ? account.bank.split(" ")[0]
                        : "Not recorded"
                      : payment.mpesaCode || "Not recorded",
                    accountNumber: manual && account ? account.accountNumber : null,
                    refLabel: manual ? "Bank ref" : "Paid by",
                    refValue: manual ? payment.bankReference || "Not provided" : payment.mpesaPayer || "Not recorded",
                    sentLabel: when(payment.createdAt) ?? "Not recorded",
                    dealerNote: payment.note,
                    odooText: odooLine(payment, odooPayments, account?.bank),
                    odooError: Boolean(payment.odooError),
                  };
                })}
                showPaymentPlaceholder={
                  mayAct && !tracker.stopped && stageNumber <= 3 && order.status !== "PAYMENT_CONFIRMED" && openPayments.length === 0
                }
                showLockedRelease={mayAct && !tracker.stopped && stageNumber <= 3}
                releaseReady={mayAct && order.status === "PAYMENT_CONFIRMED"}
                depots={depots.map((depot) => ({ id: depot.id, name: depot.name }))}
                showSync={mayAct && (order.status === "ODOO_SYNC_FAILED" || order.status === "ODOO_SYNC_PENDING")}
                syncError={order.odooSyncError}
                pfiAction={
                  mayAct && (order.status === "QUOTATION_READY" || order.status === "PFI_PENDING" || order.status === "PFI_ISSUED")
                    ? order.status === "PFI_ISSUED"
                      ? "finish"
                      : "generate"
                    : null
                }
                showDepotNote={mayAct && stageNumber > 3 && !tracker.stopped}
              />
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

                <section className="so-card sod-pay-card" id="payment">
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
