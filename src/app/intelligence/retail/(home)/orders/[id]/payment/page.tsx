import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Landmark, MapPin } from "lucide-react";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/session";
import { internalOrderAction } from "@/lib/orders/actions";
import { formatKes } from "@/lib/orders/money";
import { bankAccountByNumber, centsToAmount, paymentTotals } from "@/lib/orders/payments";
import { odooPaymentsEnabled } from "@/lib/integrations/odoo/config";
import { stageOf, statusLabel } from "@/lib/orders/stages";
import "@/app/intelligence/retail/staff-orders.css";

// Confirm and Retry Odoo run from this page and can call Odoo twice (draft, then post).
export const maxDuration = 60;

const when = (at: Date | null | undefined) =>
  at
    ? at.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })
    : "—";

const STATUS: Record<string, { label: string; tone: string }> = {
  SUBMITTED: { label: "Waiting for Trinity", tone: "wait" },
  VERIFICATION: { label: "Waiting for Trinity", tone: "wait" },
  CONFIRMED: { label: "Confirmed", tone: "ok" },
  REJECTED: { label: "Flagged", tone: "flag" },
};

/** What Odoo knows about a waiting payment. */
function odooLine(
  payment: { method: string; odooState: string | null; odooError: string | null; odooPaymentId: number | null; bankAccountNumber: string | null },
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

/** One order's payments on their own page: what was paid, where, when, by whom, with Confirm / Flag. */
export default async function OrderPaymentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");
  const mayAct = canUser(session.user, "orders", "act");

  const { id } = await params;
  const order = await prisma.dealerOrder.findUnique({
    where: { id },
    include: {
      dealerOrganization: { select: { name: true } },
      station: { select: { name: true, tradingName: true } },
      proforma: { select: { amount: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  const senderIds = [...new Set(order.payments.map((p) => p.submittedById).filter((x): x is string => Boolean(x)))];
  const senders = new Map(
    (await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" "),
    ])
  );
  const totals = paymentTotals(order.proforma?.amount ?? order.amountDue, order.payments);
  const kes = (cents: number | null) => (cents == null ? "—" : formatKes(centsToAmount(cents)));
  const waiting = order.payments.filter((p) => p.status === "SUBMITTED" || p.status === "VERIFICATION").reverse();
  const earlier = order.payments.filter((p) => p.status === "CONFIRMED" || p.status === "REJECTED");
  const odooOn = odooPaymentsEnabled();
  const orderHref = `/intelligence/retail/orders/${order.id}`;

  return (
    <div className="so">
      <header className="so-hero" aria-label="Payment review hero">
        <div className="so-hero__text">
          <div className="so-hero__crumbs">
            <Link href="/intelligence/retail/orders">Orders</Link> › <Link href={orderHref}>{order.reference}</Link> › Payment
          </div>
          <div className="so-hero__title-row">
            <h1>Payment review</h1>
            <span className={`so-pill so-pill--${stageOf(order.status)}`}>{statusLabel(order.status)}</span>
          </div>
          <div className="so-hero__meta">
            <span><Building2 size={14} /> {order.dealerOrganization.name}</span>
            <span><MapPin size={14} /> {order.station.tradingName || order.station.name}</span>
          </div>
        </div>
      </header>

      <div className="so-wrap spr">
        <Link href={orderHref} className="spr-back">
          <ArrowLeft size={15} aria-hidden /> Back to order {order.reference}
        </Link>

        <section className="spr-sum" aria-label="Payment totals">
          <div><span>PFI total</span><b>{kes(totals.totalCents)}</b></div>
          <div><span>Confirmed</span><b>{kes(totals.confirmedCents)}</b></div>
          <div><span>Waiting</span><b>{kes(totals.waitingCents)}</b></div>
          <div className="spr-sum__bal"><span>Balance if confirmed</span><b>{kes(totals.balanceCents)}</b></div>
        </section>

        {waiting.length === 0 ? (
          <section className="so-card spr-empty">
            <Landmark size={20} aria-hidden />
            <div>
              <h2>No payment waiting</h2>
              <p>
                {totals.totalCents == null
                  ? "No PFI has been issued for this order yet, so there is nothing to pay."
                  : totals.balanceCents === 0
                    ? "This order is fully paid."
                    : "The dealer hasn't sent a payment for this order yet. Sales Person Executives get an email when they do."}
              </p>
            </div>
          </section>
        ) : (
          waiting.map((payment) => {
            const account = bankAccountByNumber(payment.bankAccountNumber);
            const mpesa = payment.method !== "MANUAL";
            const status = STATUS[payment.status] ?? STATUS.SUBMITTED;
            return (
              <article key={payment.id} className="so-card spr-pay" aria-label={`Payment of ${formatKes(payment.amount)}`}>
                <div className="spr-pay__main">
                  <div className="spr-amount">
                    {formatKes(payment.amount)} <span className="spr-chip">{mpesa ? "M-PESA" : "Manual"}</span>
                  </div>
                  <span className={`spr-status spr-status--${status.tone}`}>{status.label}</span>
                  <dl className="spr-kv">
                    {mpesa ? (
                      <>
                        <dt>M-PESA code</dt>
                        <dd>{payment.mpesaCode ?? "Not recorded"}</dd>
                        {payment.mpesaPayer ? (
                          <>
                            <dt>Paid by (Odoo)</dt>
                            <dd>{payment.mpesaPayer}</dd>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <dt>Paid to</dt>
                        <dd>{account ? `${account.bank} · ${account.accountNumber}` : payment.bankAccountNumber ?? "Not recorded"}</dd>
                        <dt>Bank reference</dt>
                        <dd>{payment.bankReference || "Not provided"}</dd>
                      </>
                    )}
                    <dt>Sent</dt>
                    <dd>{when(payment.createdAt)}</dd>
                    <dt>Sent by</dt>
                    <dd>
                      {payment.submittedById && senders.get(payment.submittedById)
                        ? `${senders.get(payment.submittedById)} · ${order.dealerOrganization.name}`
                        : order.dealerOrganization.name}
                    </dd>
                    {payment.note ? (
                      <>
                        <dt>Dealer&apos;s note</dt>
                        <dd>{payment.note}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className={`spr-odoo${payment.odooError ? " is-error" : ""}`}>
                    {odooLine(payment, odooOn, account?.bank)}
                    {mayAct && payment.odooError && payment.method === "MANUAL" && payment.odooPaymentId == null ? (
                      <form action={internalOrderAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <button className="so-btn so-btn--line" name="action" value="retry-payment-odoo">Retry Odoo</button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {mayAct ? (
                  <form action={internalOrderAction} className="spr-pay__side">
                    <h2>Check, then confirm</h2>
                    <p>
                      Match the amount and {mpesa ? "M-PESA code" : "reference"} against the {mpesa ? "M-PESA" : account ? account.bank.split(" ")[0] : "bank"} statement.
                      Confirming marks it paid; once the PFI is covered, Release to Depot unlocks.
                    </p>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <input type="hidden" name="returnTo" value={orderHref} />
                    <label className="spr-note">
                      <span>Note (optional, shown to the dealer if you flag)</span>
                      <input type="text" name="note" maxLength={300} />
                    </label>
                    <div className="spr-actions">
                      <button className="so-btn so-btn--gold" name="action" value="confirm-payment">Confirm payment</button>
                      <button className="so-btn so-btn--warn" name="action" value="reject-payment">Flag a problem</button>
                    </div>
                  </form>
                ) : (
                  <p className="spr-pay__side spr-readonly">Your role can view payments but not confirm them.</p>
                )}
              </article>
            );
          })
        )}

        {earlier.length > 0 ? (
          <section className="so-card spr-earlier" aria-label="Earlier payments">
            <h2>Earlier payments on this order</h2>
            <ul>
              {earlier.map((p) => {
                const s = STATUS[p.status];
                return (
                  <li key={p.id}>
                    <b>{formatKes(p.amount)}</b>
                    <span>{p.method === "MANUAL" ? `Manual · ${p.bankReference || "no reference"}` : `M-PESA · ${p.mpesaCode ?? ""}`}</span>
                    <span>{when(p.createdAt)}</span>
                    <span className={`spr-status spr-status--${s.tone}`}>{s.label}</span>
                    {p.status === "REJECTED" && p.reviewNote ? <span className="spr-why">“{p.reviewNote}”</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
