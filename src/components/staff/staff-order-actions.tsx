"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ArrowRight, FileText, Landmark, Lock, RefreshCw, Truck, X } from "lucide-react";
import { internalOrderAction } from "@/lib/orders/actions";

export type StaffWaitingPayment = {
  id: string;
  amountLabel: string;
  methodLabel: string;
  methodKind: "manual" | "mpesa";
  accountLabel: string;
  accountValue: string;
  refLabel: string;
  refValue: string;
  sentLabel: string;
  dealerNote: string | null;
  odooText: string;
  odooError: boolean;
  canRetryOdoo: boolean;
};

export type StaffOrderActionsProps = {
  orderId: string;
  orderReference: string;
  pfiNumber: string | null;
  pfiAmountLabel: string | null;
  mayAct: boolean;
  waiting: StaffWaitingPayment[];
  showPaymentPlaceholder: boolean;
  showLockedRelease: boolean;
  releaseReady: boolean;
  depots: { id: string; name: string }[];
  showSync: boolean;
  syncError: string | null;
  pfiAction: "generate" | "finish" | null;
  showDepotNote: boolean;
};

export function StaffOrderActions({
  orderId,
  orderReference,
  pfiNumber,
  pfiAmountLabel,
  mayAct,
  waiting,
  showPaymentPlaceholder,
  showLockedRelease,
  releaseReady,
  depots,
  showSync,
  syncError,
  pfiAction,
  showDepotNote,
}: StaffOrderActionsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = waiting.find((payment) => payment.id === openId) ?? null;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (openId && !waiting.some((payment) => payment.id === openId)) setOpenId(null);
  }, [openId, waiting]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="sod-actions">
      {!mayAct ? <p className="so-preview__hint">Your role can view this order but not act on it.</p> : null}

      {showSync ? (
        <div className="sod-action sod-action--ready">
          <div className="sod-action__lead">
            <span className="sod-action__ico" aria-hidden>
              <RefreshCw size={16} strokeWidth={1.75} />
            </span>
            <span className="sod-action__copy">
              <span className="sod-action__title">Retry Odoo sync</span>
              {syncError ? <span className="sod-action__sub">Last attempt: {syncError}</span> : null}
            </span>
          </div>
          <form action={internalOrderAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <button className="so-btn so-btn--gold" name="action" value="retry-sync">
              Retry sync
            </button>
          </form>
        </div>
      ) : null}

      {pfiAction ? (
        <div className="sod-action sod-action--ready">
          <div className="sod-action__lead">
            <span className="sod-action__ico" aria-hidden>
              <FileText size={16} strokeWidth={1.75} />
            </span>
            <span className="sod-action__copy">
              <span className="sod-action__title">{pfiAction === "finish" ? "Finish PFI" : "Generate PFI"}</span>
              <span className="sod-action__sub">Issue the pro forma invoice so the dealer can pay.</span>
            </span>
          </div>
          <form action={internalOrderAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <button className="so-btn so-btn--gold" name="action" value="generate-pfi">
              {pfiAction === "finish" ? "Finish PFI" : "Generate PFI"}
            </button>
          </form>
        </div>
      ) : null}

      {waiting.length > 0 ? (
        <article className="sod-paycard">
          <div className="sod-paycard__head">
            <span className="sod-paycard__mark" aria-hidden>
              <Landmark size={16} strokeWidth={1.75} />
            </span>
            <div className="sod-paycard__intro">
              <h3 className="sod-paycard__title">Confirm Payment</h3>
              <p className="sod-paycard__sub">Check the payment before confirming and receipting to accounts.</p>
            </div>
            <span className="sod-paycard__count">{waiting.length} waiting</span>
          </div>
          {waiting.map((payment) => (
            <div className="sod-paycard__item" key={payment.id}>
              <div className="sod-paycard__row">
                <span className="sod-paycard__amount">{payment.amountLabel}</span>
                <span className={`sod-paycard__method${payment.methodKind === "mpesa" ? " is-mpesa" : ""}`}>
                  {payment.methodLabel}
                </span>
                <button
                  type="button"
                  className="sod-paycard__review"
                  onClick={() => setOpenId(payment.id)}
                  aria-label={`Review payment of ${payment.amountLabel}`}
                >
                  Review payment
                  <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
                </button>
              </div>
              <dl className="sod-paycard__facts">
                <div className="sod-paycard__fact">
                  <dt>{payment.accountLabel}</dt>
                  <dd>{payment.accountValue}</dd>
                </div>
                <div className="sod-paycard__fact">
                  <dt>{payment.refLabel}</dt>
                  <dd>{payment.refValue}</dd>
                </div>
                <div className="sod-paycard__fact">
                  <dt>Sent</dt>
                  <dd>{payment.sentLabel}</dd>
                </div>
              </dl>
              {payment.odooError ? <p className="sod-paycard__alert">{payment.odooText}</p> : null}
            </div>
          ))}
        </article>
      ) : null}

      {showPaymentPlaceholder ? (
        <a href="#payment" className="sod-action sod-action--ready sod-action--link">
          <span className="sod-action__ico" aria-hidden>
            <Landmark size={16} strokeWidth={1.75} />
          </span>
          <span className="sod-action__copy">
            <span className="sod-action__title">Confirm Payment</span>
            <span className="sod-action__sub">
              Available once the dealer submits payment details. See this order&apos;s payment summary.
            </span>
          </span>
          <span className="sod-action__go" aria-hidden>
            <ArrowRight size={14} strokeWidth={2.4} />
          </span>
        </a>
      ) : null}

      {releaseReady ? (
        <div className="sod-action sod-action--ready sod-action--release">
          <div className="sod-action__lead">
            <span className="sod-action__ico" aria-hidden>
              <Truck size={16} strokeWidth={1.75} />
            </span>
            <span className="sod-action__copy">
              <span className="sod-action__title">Release to Depot</span>
              <span className="sod-action__sub">Payment confirmed — choose the depot that will load this order.</span>
            </span>
          </div>
          <form action={internalOrderAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <select name="depotId" defaultValue={depots[0]?.id} aria-label="Depot">
              {depots.map((depot) => (
                <option key={depot.id} value={depot.id}>
                  {depot.name}
                </option>
              ))}
            </select>
            <button className="so-btn so-btn--blue" name="action" value="release">
              Release to depot
            </button>
          </form>
        </div>
      ) : null}

      {showLockedRelease ? (
        <Link href="/intelligence/retail/orders?stage=depot" className="sod-action sod-action--locked sod-action--link">
          <span className="sod-action__ico" aria-hidden>
            <Truck size={16} strokeWidth={1.75} />
          </span>
          <span className="sod-action__copy">
            <span className="sod-action__title">Release to Depot</span>
            <span className="sod-action__sub">
              Available after payment confirmation.
              <br />
              See orders already at the depot.
            </span>
          </span>
          <span className="sod-action__go" aria-hidden>
            <Lock size={13} strokeWidth={2.2} />
          </span>
        </Link>
      ) : null}

      {showDepotNote ? (
        <p className="so-preview__hint">
          This order is with the depot — loading, dispatch and delivery are recorded on the Depot Portal.
        </p>
      ) : null}

      {open ? (
        <div className="sod-review" role="presentation" onMouseDown={() => setOpenId(null)}>
          <div
            className="sod-review__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="sod-review__head">
              <div>
                <h2 id={titleId}>Review payment</h2>
                <p>
                  {orderReference}
                  {pfiNumber ? ` · PFI ${pfiNumber}` : ""}
                  {pfiAmountLabel ? ` · ${pfiAmountLabel}` : ""}
                </p>
              </div>
              <button ref={closeRef} type="button" className="sod-review__close" onClick={() => setOpenId(null)} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            <div className="sod-review__amount">
              <strong>{open.amountLabel}</strong>
              <span className={`sod-paycard__method${open.methodKind === "mpesa" ? " is-mpesa" : ""}`}>{open.methodLabel}</span>
            </div>

            <dl className="sod-paycard__facts sod-review__facts">
              <div className="sod-paycard__fact">
                <dt>{open.accountLabel}</dt>
                <dd>{open.accountValue}</dd>
              </div>
              <div className="sod-paycard__fact">
                <dt>{open.refLabel}</dt>
                <dd>{open.refValue}</dd>
              </div>
              <div className="sod-paycard__fact">
                <dt>Sent</dt>
                <dd>{open.sentLabel}</dd>
              </div>
            </dl>

            {open.dealerNote ? (
              <p className="sod-review__note">
                <span>Dealer note</span>
                {open.dealerNote}
              </p>
            ) : null}

            <p className={`sod-review__odoo${open.odooError ? " is-error" : ""}`}>{open.odooText}</p>

            {open.canRetryOdoo ? (
              <form action={internalOrderAction} className="sod-review__retry">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="paymentId" value={open.id} />
                <button className="so-btn so-btn--line" name="action" value="retry-payment-odoo">
                  Retry Odoo
                </button>
              </form>
            ) : null}

            <form action={internalOrderAction} className="sod-review__form">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="paymentId" value={open.id} />
              <label className="sod-review__field">
                <span>Note (optional)</span>
                <input
                  type="text"
                  name="note"
                  maxLength={300}
                  placeholder="Add a note for the payment record"
                  aria-label="Verification note"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
              </label>
              <ReviewButtons />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewButtons() {
  const { pending } = useFormStatus();
  const [which, setWhich] = useState<"confirm" | "flag" | null>(null);

  useEffect(() => {
    if (!pending) setWhich(null);
  }, [pending]);

  return (
    <div className="sod-review__actions">
      <button
        className="so-btn so-btn--gold"
        name="action"
        value="confirm-payment"
        disabled={pending}
        onClick={() => setWhich("confirm")}
      >
        {pending && which === "confirm" ? "Confirming…" : "Confirm payment"}
      </button>
      <button
        className="so-btn so-btn--warn"
        name="action"
        value="reject-payment"
        disabled={pending}
        onClick={() => setWhich("flag")}
      >
        {pending && which === "flag" ? "Flagging…" : "Flag payment"}
      </button>
    </div>
  );
}
