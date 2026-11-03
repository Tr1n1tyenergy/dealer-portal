"use client";

import "./place-order.css";
import { openSupport } from "./support-card";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { useFormStatus } from "react-dom";
import { placeOrderAction } from "@/lib/orders/actions";
import { deliveryWindow, MAX_LITRES, typedLitres } from "@/lib/orders/order-input";
import { orderEstimate } from "@/lib/orders/order-estimate";
import { formatMoney } from "@/lib/orders/pfi-totals";
import { PageHead } from "@/components/layout/page-head";

/** prices: the station's EPRA prices per litre, or null when the portal has none for it. */
type Station = { id: string; name: string; prices: { pms: number; ago: number } | null };
type WizardStep = "details" | "review";

const QUICK = [10000, 20000, 30000] as const;

const NEXT_STEPS = [
  { title: "Order submitted", text: "Your request is sent to Trinity." },
  { title: "Quotation and PFI", text: "Trinity prepares your quotation and Pro Forma Invoice." },
  { title: "Payment", text: "You pay against the PFI and Trinity confirms it." },
  { title: "Released to depot", text: "The depot loads and dispatches your fuel." },
  { title: "Delivered", text: "You can follow the delivery to your station." },
] as const;

const HEAD = {
  details: {
    title: "Place an order",
    copy: "Choose your station, the fuel you need and when you need it.",
  },
  review: {
    title: "Review your order",
    copy: "Check the station, fuel and delivery date, then submit the order to Trinity.",
  },
} as const;

const STEPS = ["Order details", "Review order", "Submit order"] as const;

function bumpQty(value: number, delta: number) {
  return Math.min(MAX_LITRES, Math.max(0, value + delta));
}

function formatLitres(n: number) {
  return `${n.toLocaleString()} L`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatDisplayDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Step 1 is current while filling in; on review step 1 is done and step 2 current. */
function stepState(current: WizardStep, index: number) {
  const at = current === "details" ? 0 : 1;
  return index < at ? "is-done" : index === at ? "is-active" : "";
}

function newSubmissionKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs a secure context; fall back for plain-http LAN testing.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function SubmitOrderButton({ disabled, unavailable }: { disabled: boolean; unavailable: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="ui-btn ui-btn--primary po-cta" disabled={disabled || unavailable || pending}>
      {unavailable ? "Ordering unavailable" : pending ? "Submitting…" : "Submit order"}
    </button>
  );
}

/** orderingNotice: shown up front when dealer ordering is switched off (Submit is then disabled). */
export function PlaceOrderForm({ stations, orderingNotice }: { stations: Station[]; orderingNotice: string | null }) {
  const [step, setStep] = useState<WizardStep>("details");
  // One id per form load, created in the browser after mount (not during server render):
  // a resubmit of this page (retry, double submit) returns the order it already created.
  const [submissionKey, setSubmissionKey] = useState("");
  useEffect(() => setSubmissionKey(newSubmissionKey()), []);
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [pms, setPms] = useState(20000);
  const [ago, setAgo] = useState(0);
  // Nairobi's calendar day, so the default is never "yesterday" between midnight and 3am.
  const dateWindow = useMemo(() => deliveryWindow(), []);
  const [deliveryDate, setDeliveryDate] = useState(() => dateWindow.min);
  const [state, formAction] = useActionState(placeOrderAction, null);

  const station = stations.find((s) => s.id === stationId) ?? stations[0];
  const total = pms + ago;
  const summaryDate = useMemo(() => formatDisplayDate(deliveryDate), [deliveryDate]);
  const head = HEAD[step];
  const estimate = orderEstimate({ pms, ago }, station?.prices ?? null);
  const canReview = total > 0 && Boolean(stationId) && Boolean(deliveryDate);

  function goToReview() {
    if (!canReview) return;
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToDetails() {
    setStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function guardSubmit(formData: FormData) {
    if (step !== "review") return;
    formAction(formData);
  }

  const qty = (label: "PMS" | "AGO", name: string, value: number, set: (fn: (v: number) => number) => void) => (
    <fieldset className="po-fuel">
      <legend>
        {label} <span>{name}</span>
      </legend>
      <div className="po-qty">
        <button type="button" className="po-qty__btn" aria-label={`Decrease ${label}`} onClick={() => set((v) => bumpQty(v, -1000))}>
          <Minus size={16} strokeWidth={2.5} />
        </button>
        <input
          className="po-qty__input"
          aria-label={`${label} litres`}
          inputMode="numeric"
          autoComplete="off"
          value={value.toLocaleString("en-US")}
          onChange={(e) => set(() => typedLitres(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
        <span className="po-qty__unit">L</span>
        <button type="button" className="po-qty__btn" aria-label={`Increase ${label}`} onClick={() => set((v) => bumpQty(v, 1000))}>
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>
      <div className="po-quick" role="group" aria-label={`Quick ${label} amounts`}>
        {QUICK.map((q) => (
          <button key={q} type="button" className="po-quick__btn" aria-pressed={value === q} onClick={() => set(() => q)}>
            {q.toLocaleString()} L
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="ui-page po">
      <PageHead
        back={{ href: "/dealer/orders", label: "Orders" }}
        title={head.title}
        description={head.copy}
        action={
          <button type="button" className="ui-btn ui-btn--quiet" onClick={openSupport}>
            Need help?
          </button>
        }
      />

      <ol className="po-steps" aria-label="Order progress">
        {STEPS.map((label, index) => {
          const state = stepState(step, index);
          return (
            <li key={label} className={`po-step ${state}`} aria-current={state === "is-active" ? "step" : undefined}>
              <span className="po-step__num" aria-hidden>
                {state === "is-done" ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {orderingNotice ? (
        <div className="po-notice" role="status">
          <strong>{orderingNotice.split(". ")[0]}.</strong> {orderingNotice.split(". ").slice(1).join(". ")}
        </div>
      ) : null}

      <form action={guardSubmit} className="po-layout">
        <input type="hidden" name="stationId" value={stationId} />
        <input type="hidden" name="pms" value={pms} />
        <input type="hidden" name="ago" value={ago} />
        <input type="hidden" name="requestedDeliveryDate" value={deliveryDate} />
        <input type="hidden" name="submissionKey" value={submissionKey} />

        <div className="po-main">
          {step === "details" ? (
            <>
              <section className="ui-panel" aria-labelledby="po-where">
                <h2 id="po-where" className="ui-section-title">
                  Station and delivery
                </h2>
                <div className="po-fields">
                  <label className="ui-field">
                    Station
                    <select className="ui-input" value={stationId} onChange={(e) => setStationId(e.target.value)} required>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-field">
                    Requested delivery date
                    <input
                      className="ui-input"
                      type="date"
                      value={deliveryDate}
                      min={dateWindow.min}
                      max={dateWindow.max}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      // Open the calendar wherever the field is clicked, not only on the small icon.
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {
                          // Older browsers: the native click behaviour still applies.
                        }
                      }}
                      required
                    />
                    <span className="ui-field__help">Up to {formatDisplayDate(dateWindow.max)} (current EPRA prices)</span>
                  </label>
                </div>
              </section>

              <section className="ui-panel" aria-labelledby="po-fuel">
                <h2 id="po-fuel" className="ui-section-title">
                  Fuel
                </h2>
                <div className="po-fuels">
                  {qty("PMS", "Premium motor spirit", pms, setPms)}
                  {qty("AGO", "Automotive gas oil", ago, setAgo)}
                </div>
              </section>
            </>
          ) : (
            <section className="ui-panel" aria-labelledby="po-confirm">
              <h2 id="po-confirm" className="ui-section-title">
                Confirm order details
              </h2>
              <dl className="po-review">
                <div>
                  <dt>Station</dt>
                  <dd>{station?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Requested delivery</dt>
                  <dd>{summaryDate}</dd>
                </div>
                {pms > 0 ? (
                  <div>
                    <dt>PMS</dt>
                    <dd>{formatLitres(pms)}</dd>
                  </div>
                ) : null}
                {ago > 0 ? (
                  <div>
                    <dt>AGO</dt>
                    <dd>{formatLitres(ago)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="po-review__note">
                Once submitted, Trinity prepares your quotation and PFI. You can follow the order under Orders.
              </p>
              <button type="button" className="ui-btn ui-btn--secondary" onClick={goToDetails}>
                Edit order details
              </button>
            </section>
          )}
        </div>

        <aside className="po-aside">
          <section className="ui-panel po-summary" aria-labelledby="po-summary-title">
            <h2 id="po-summary-title" className="ui-section-title">
              Order summary
            </h2>
            <dl>
              <div>
                <dt>Station</dt>
                <dd>{station?.name ?? "—"}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{summaryDate}</dd>
              </div>
              {pms > 0 ? (
                <div>
                  <dt>PMS</dt>
                  <dd>{formatLitres(pms)}</dd>
                </div>
              ) : null}
              {ago > 0 ? (
                <div>
                  <dt>AGO</dt>
                  <dd>{formatLitres(ago)}</dd>
                </div>
              ) : null}
              <div className="po-summary__strong">
                <dt>Total volume</dt>
                <dd>{formatLitres(total)}</dd>
              </div>
            </dl>
            {estimate ? (
              <div className="po-amount" aria-live="polite">
                <span>Estimated amount (incl. 8% VAT)</span>
                <strong>KES {formatMoney(estimate.total)}</strong>
                <small>
                  KES {formatMoney(estimate.subtotal)} + VAT KES {formatMoney(estimate.vat)}. The final amount is on your PFI.
                </small>
              </div>
            ) : total > 0 ? (
              <p className="po-amount po-amount--none">The amount will be on your PFI.</p>
            ) : null}

            {step === "details" ? (
              <button type="button" className="ui-btn ui-btn--primary po-cta" disabled={!canReview} onClick={goToReview}>
                Review order
              </button>
            ) : (
              <>
                {state?.error ? (
                  <p className="ui-field__error" role="alert">
                    {state.error}
                  </p>
                ) : null}
                <SubmitOrderButton disabled={total <= 0} unavailable={Boolean(orderingNotice)} />
              </>
            )}
          </section>

          <section className="po-next" aria-labelledby="po-next-title">
            <h2 id="po-next-title" className="ui-section-title">
              What happens next
            </h2>
            <ol>
              {NEXT_STEPS.map((item) => (
                <li key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </form>
    </div>
  );
}
