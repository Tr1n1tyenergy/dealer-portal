"use client";

import "@/app/dealer/dealer-place-order.css";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Droplets,
  FileText,
  Fuel,
  Info,
  Layers,
  MapPin,
  Minus,
  Plus,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { placeOrderAction } from "@/lib/orders/actions";
import { deliveryWindow, MAX_LITRES, typedLitres } from "@/lib/orders/order-input";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import { formatMoney, pfiTotals } from "@/lib/orders/pfi-totals";
import { DEALER_FORECOURT_SRC, dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import { DealerHeroActions } from "@/components/dealer/dealer-hero-actions";

type Station = { id: string; name: string; code: string | null };
type WizardStep = "details" | "review";

const QUICK = [10000, 20000, 30000] as const;

const NEXT_STEPS = [
  {
    title: "Order submitted",
    text: "Your request is sent to Trinity.",
  },
  {
    title: "Quotation and PFI",
    text: "Trinity prepares your quotation and Pro Forma Invoice.",
  },
  {
    title: "Payment",
    text: "You pay against the PFI and Trinity confirms it.",
  },
  {
    title: "Released to depot",
    text: "The depot loads and dispatches your fuel.",
  },
  {
    title: "Delivered",
    text: "You can follow the delivery to your station.",
  },
] as const;

const HERO = {
  details: {
    title: "Create fuel order",
    copy: "Select your station, specify the required products and tell us when you need the delivery.",
  },
  review: {
    title: "Review fuel order",
    copy: "Check your order details below. Make sure everything is correct before submitting your order to Trinity.",
  },
} as const;

function bumpQty(value: number, delta: number) {
  return Math.min(MAX_LITRES, Math.max(0, value + delta));
}

function formatLitres(n: number) {
  return `${n.toLocaleString("en-US")} L`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatDisplayDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function wizardState(current: WizardStep, index: 1 | 2 | 3) {
  if (current === "details") return index === 1 ? "is-active" : "";
  if (index === 1) return "is-done";
  if (index === 2) return "is-active";
  return "";
}

function newSubmissionKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function SubmitOrderButton({ disabled, unavailable }: { disabled: boolean; unavailable: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="po__cta" disabled={disabled || unavailable || pending}>
      {unavailable ? "Ordering unavailable" : pending ? "Submitting…" : "Submit Order"}
      <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
}

function estimateTotals(stationCode: string | null | undefined, pms: number, ago: number) {
  if (!stationCode) return null;
  const lines: { product: "PMS" | "AGO"; quantityLitres: number; unitPriceExVat: string }[] = [];
  if (pms > 0) {
    const price = epraUnitPriceForStation(stationCode, "PMS");
    if (price == null) return null;
    lines.push({ product: "PMS", quantityLitres: pms, unitPriceExVat: String(price) });
  }
  if (ago > 0) {
    const price = epraUnitPriceForStation(stationCode, "AGO");
    if (price == null) return null;
    lines.push({ product: "AGO", quantityLitres: ago, unitPriceExVat: String(price) });
  }
  if (lines.length === 0) return null;
  return pfiTotals(lines);
}

/** orderingNotice: shown up front when dealer ordering is switched off (Submit is then disabled). */
export function PlaceOrderForm({ stations, orderingNotice }: { stations: Station[]; orderingNotice: string | null }) {
  const [step, setStep] = useState<WizardStep>("details");
  const [submissionKey, setSubmissionKey] = useState("");
  useEffect(() => setSubmissionKey(newSubmissionKey()), []);
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [pms, setPms] = useState(20000);
  const [ago, setAgo] = useState(10000);
  const dateWindow = useMemo(() => deliveryWindow(), []);
  const [deliveryDate, setDeliveryDate] = useState(() => dateWindow.min);
  const [state, formAction] = useActionState(placeOrderAction, null);

  const station = stations.find((s) => s.id === stationId) ?? stations[0];
  const total = pms + ago;
  const summaryDate = useMemo(() => formatDisplayDate(deliveryDate), [deliveryDate]);
  const hero = HERO[step];
  const canReview = total > 0 && Boolean(stationId) && Boolean(deliveryDate);
  const estimate = useMemo(
    () => estimateTotals(station?.code, pms, ago),
    [station?.code, pms, ago],
  );

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

  return (
    <div className="po">
      <section className="po__hero" style={dealerHeroPhotoStyle}>
        <div className="po__hero-veil" aria-hidden />
        <div className="po__hero-inner">
          <nav className="po__crumbs" aria-label="Breadcrumb">
            <Link href="/dealer/orders" className="po__crumb">
              Orders
            </Link>
            <ChevronRight className="po__crumb-sep" size={14} strokeWidth={2.4} aria-hidden />
            <span className="po__crumb is-current">
              {step === "review" ? "Review Order" : "Place Order"}
            </span>
          </nav>
          <h1>{hero.title}</h1>
          <p>{hero.copy}</p>
          <DealerHeroActions showPlaceOrder={false} />
        </div>
      </section>

      <div className="po__wizard-wrap">
        <div className="po__inner">
          <ol className={`po__wizard is-${step}`} aria-label="Order progress">
            <li className={`po__wizard-card ${wizardState(step, 1)}`}>
              <span className="po__wizard-num">1</span>
              <span className="po__wizard-icon" aria-hidden>
                <FileText size={18} strokeWidth={2.1} />
              </span>
              <span className="po__wizard-copy">
                <strong>Order details</strong>
                <span>Select station and products</span>
              </span>
              {step === "review" ? (
                <span className="po__wizard-done" aria-label="Completed">
                  <Check size={14} strokeWidth={3} aria-hidden />
                </span>
              ) : null}
            </li>
            <li className={`po__wizard-card ${wizardState(step, 2)}`}>
              <span className="po__wizard-num">2</span>
              <span className="po__wizard-icon" aria-hidden>
                <FileText size={18} strokeWidth={2.1} />
              </span>
              <span className="po__wizard-copy">
                <strong>Review order</strong>
                <span>Check quantities, delivery and amount</span>
              </span>
            </li>
            <li className={`po__wizard-card ${wizardState(step, 3)}`}>
              <span className="po__wizard-num">3</span>
              <span className="po__wizard-icon" aria-hidden>
                <CircleCheck size={18} strokeWidth={2.1} />
              </span>
              <span className="po__wizard-copy">
                <strong>Submit order</strong>
                <span>Confirm and place your order</span>
              </span>
            </li>
          </ol>
        </div>
      </div>

      <div className="po__inner">
        {orderingNotice ? (
          <div className="po__notice" role="status">
            <strong>{orderingNotice.split(". ")[0]}.</strong> {orderingNotice.split(". ").slice(1).join(". ")}
          </div>
        ) : null}

        <form action={guardSubmit} className="po__layout">
          <input type="hidden" name="stationId" value={stationId} />
          <input type="hidden" name="pms" value={pms} />
          <input type="hidden" name="ago" value={ago} />
          <input type="hidden" name="requestedDeliveryDate" value={deliveryDate} />
          <input type="hidden" name="submissionKey" value={submissionKey} />

          <div className="po__main">
            {step === "details" ? (
              <>
                <section className="po__card">
                  <header className="po__card-head">
                    <span className="po__card-ico" aria-hidden>
                      <MapPin size={18} strokeWidth={2.1} />
                    </span>
                    <div>
                      <h2>Station &amp; delivery</h2>
                      <p>Choose the station that will receive this order and when you need the delivery.</p>
                    </div>
                  </header>

                  <div className="po__fields">
                    <div className="po__field">
                      <label htmlFor="station-picker">Station</label>
                      <div className="po__station">
                        <div
                          className="po__station__thumb"
                          style={{ backgroundImage: `url("${DEALER_FORECOURT_SRC}")` }}
                          aria-hidden
                        />
                        <div className="po__station__body">
                          <strong>{station?.name ?? "Select station"}</strong>
                          <span className="po__station__status">
                            <i /> Active station
                          </span>
                        </div>
                        <ChevronDown size={18} className="po__chev" aria-hidden />
                        <select
                          id="station-picker"
                          value={stationId}
                          onChange={(e) => setStationId(e.target.value)}
                          required
                          aria-label="Station"
                        >
                          {stations.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="po__field">
                      <label htmlFor="delivery-date">Requested delivery date</label>
                      <div className="po__date">
                        <Calendar size={20} strokeWidth={1.8} color="#3853a4" aria-hidden />
                        <div className="po__date__body">
                          <strong>{summaryDate}</strong>
                          <em>Up to {formatDisplayDate(dateWindow.max)} (current EPRA prices)</em>
                        </div>
                        <ChevronDown size={18} className="po__chev" aria-hidden />
                        <input
                          id="delivery-date"
                          type="date"
                          value={deliveryDate}
                          min={dateWindow.min}
                          max={dateWindow.max}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          onClick={(e) => {
                            try {
                              e.currentTarget.showPicker();
                            } catch {
                              /* native click still applies */
                            }
                          }}
                          required
                          aria-label="Requested delivery date"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="po__card">
                  <header className="po__card-head">
                    <span className="po__card-ico" aria-hidden>
                      <Fuel size={18} strokeWidth={2.1} />
                    </span>
                    <div>
                      <h2>Fuel requirements</h2>
                      <p>Specify the required product quantities in litres.</p>
                    </div>
                  </header>

                  <div className="po__products">
                    <article className="po__product is-pms">
                      <div className="po__product-head">
                        <span className="po__product-ico" aria-hidden>
                          <Fuel size={16} />
                        </span>
                        <div>
                          <strong>PMS</strong>
                          <em>Premium Motor Spirit</em>
                        </div>
                      </div>
                      <div className="po__qty">
                        <button
                          type="button"
                          className="po__qty-btn"
                          aria-label="Decrease PMS"
                          onClick={() => setPms((v) => bumpQty(v, -1000))}
                        >
                          <Minus size={16} strokeWidth={2.5} />
                        </button>
                        <input
                          className="po__qty-input"
                          aria-label="PMS litres"
                          inputMode="numeric"
                          autoComplete="off"
                          value={pms.toLocaleString("en-US")}
                          onChange={(e) => setPms(typedLitres(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          className="po__qty-btn"
                          aria-label="Increase PMS"
                          onClick={() => setPms((v) => bumpQty(v, 1000))}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        <span className="po__qty-unit">L</span>
                      </div>
                      <div className="po__quick">
                        <span>Quick quantities</span>
                        <div className="po__quick-row">
                          {QUICK.map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={pms === q ? "is-on" : undefined}
                              onClick={() => setPms(q)}
                            >
                              {q.toLocaleString("en-US")} L
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>

                    <article className="po__product is-ago">
                      <div className="po__product-head">
                        <span className="po__product-ico" aria-hidden>
                          <Fuel size={16} />
                        </span>
                        <div>
                          <strong>AGO</strong>
                          <em>Automotive Gas Oil</em>
                        </div>
                      </div>
                      <div className="po__qty">
                        <button
                          type="button"
                          className="po__qty-btn"
                          aria-label="Decrease AGO"
                          onClick={() => setAgo((v) => bumpQty(v, -1000))}
                        >
                          <Minus size={16} strokeWidth={2.5} />
                        </button>
                        <input
                          className="po__qty-input"
                          aria-label="AGO litres"
                          inputMode="numeric"
                          autoComplete="off"
                          value={ago.toLocaleString("en-US")}
                          onChange={(e) => setAgo(typedLitres(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          className="po__qty-btn"
                          aria-label="Increase AGO"
                          onClick={() => setAgo((v) => bumpQty(v, 1000))}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        <span className="po__qty-unit">L</span>
                      </div>
                      <div className="po__quick">
                        <span>Quick quantities</span>
                        <div className="po__quick-row">
                          {QUICK.map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={ago === q ? "is-on" : undefined}
                              onClick={() => setAgo(q)}
                            >
                              {q.toLocaleString("en-US")} L
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="po__total-bar">
                    <div className="po__total-bar-left">
                      <Layers size={18} color="#3853a4" aria-hidden />
                      <span>Total order volume</span>
                    </div>
                    <strong>{formatLitres(total)}</strong>
                  </div>
                </section>
              </>
            ) : (
              <section className="po__card po__review">
                <header className="po__card-head">
                  <span className="po__card-ico" aria-hidden>
                    <CheckCircle2 size={18} strokeWidth={2.1} />
                  </span>
                  <div>
                    <h2>Confirm order details</h2>
                    <p>Review your fuel order before submitting it to Trinity.</p>
                  </div>
                  {canReview ? (
                    <span className="po__review-badge">
                      <i /> Ready to submit
                    </span>
                  ) : null}
                </header>

                <div className="po__review-grid">
                  <div className="po__review-tile po__review-station">
                    <div
                      className="po__station__thumb"
                      style={{ backgroundImage: `url("${DEALER_FORECOURT_SRC}")` }}
                      aria-hidden
                    />
                    <div>
                      <span className="po__review-kicker">
                        <MapPin size={12} aria-hidden /> Station
                      </span>
                      <strong>{station?.name ?? "—"}</strong>
                      <em>
                        <i /> Active station
                        <span className="po__review-meta"> · Kenya</span>
                      </em>
                    </div>
                  </div>
                  <div className="po__review-tile">
                    <span className="po__card-ico" aria-hidden>
                      <Calendar size={16} />
                    </span>
                    <div>
                      <span className="po__review-kicker">Requested delivery</span>
                      <strong>{summaryDate}</strong>
                      <p className="po__review-hint">
                        Up to {formatDisplayDate(dateWindow.max)} (current EPRA prices)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="po__review-products">
                  <article className="po__review-fuel is-pms">
                    <div className="po__review-fuel__top">
                      <span className="po__review-fuel__ico" aria-hidden>
                        <Fuel size={18} strokeWidth={2.2} />
                      </span>
                      <div className="po__review-fuel__titles">
                        <strong>PMS</strong>
                        <span>Premium Motor Spirit</span>
                      </div>
                    </div>
                    <p className="po__review-fuel__qty">{pms > 0 ? formatLitres(pms) : "—"}</p>
                    <span className="po__review-fuel__wash" aria-hidden>
                      <Droplets size={118} strokeWidth={1.05} />
                    </span>
                  </article>
                  <article className="po__review-fuel is-ago">
                    <div className="po__review-fuel__top">
                      <span className="po__review-fuel__ico" aria-hidden>
                        <Fuel size={18} strokeWidth={2.2} />
                      </span>
                      <div className="po__review-fuel__titles">
                        <strong>AGO</strong>
                        <span>Automotive Gas Oil</span>
                      </div>
                    </div>
                    <p className="po__review-fuel__qty">{ago > 0 ? formatLitres(ago) : "—"}</p>
                    <span className="po__review-fuel__wash" aria-hidden>
                      <Fuel size={118} strokeWidth={1.05} />
                    </span>
                  </article>
                </div>

                <div className="po__total-bar is-review">
                  <div className="po__total-bar-left">
                    <Layers size={18} color="#3853a4" aria-hidden />
                    <div>
                      <span>Total order volume</span>
                      <em>
                        {pms > 0 ? `PMS ${formatLitres(pms)}` : null}
                        {pms > 0 && ago > 0 ? " · " : null}
                        {ago > 0 ? `AGO ${formatLitres(ago)}` : null}
                        {pms <= 0 && ago <= 0 ? "No products selected" : null}
                      </em>
                    </div>
                  </div>
                  <strong>{formatLitres(total)}</strong>
                </div>

                <div className="po__info">
                  <Info size={18} strokeWidth={2} aria-hidden />
                  <p>
                    <b>Ready to submit.</b> Once submitted, this order will be sent to Trinity for
                    quotation processing. You can monitor its progress from My Orders.
                  </p>
                </div>

                <button type="button" className="po__back" onClick={goToDetails}>
                  <ArrowLeft size={16} aria-hidden />
                  Edit order details
                </button>
              </section>
            )}
          </div>

          <aside className="po__aside">
            <div className="po__summary">
              <div className="po__summary-head">
                <FileText size={18} aria-hidden />
                <h3>Order summary</h3>
              </div>
              <dl>
                <div>
                  <dt>Station</dt>
                  <dd>{station?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{summaryDate}</dd>
                </div>
                <div>
                  <dt>PMS</dt>
                  <dd>{formatLitres(pms)}</dd>
                </div>
                <div>
                  <dt>AGO</dt>
                  <dd>{formatLitres(ago)}</dd>
                </div>
              </dl>
              <div className="po__summary-total">
                <span>Total volume</span>
                <strong>{formatLitres(total)}</strong>
              </div>

              <div className="po__price">
                <div className="po__price-label">Estimated amount (incl. 8% VAT)</div>
                {estimate ? (
                  <>
                    <div className="po__price-amount">KES {formatMoney(estimate.total)}</div>
                    <div className="po__price-break">
                      KES {formatMoney(estimate.subtotal)} + VAT KES {formatMoney(estimate.vat)}
                    </div>
                    <div className="po__price-note">The final amount is on your PFI.</div>
                  </>
                ) : (
                  <>
                    <div className="po__price-amount">Estimate pending</div>
                    <div className="po__price-note">
                      {total <= 0
                        ? "Add PMS or AGO to see an estimate."
                        : "Pricing is confirmed on your PFI after submission."}
                    </div>
                  </>
                )}
              </div>

              {step === "details" ? (
                <button type="button" className="po__cta" disabled={!canReview} onClick={goToReview}>
                  Review order
                  <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
                </button>
              ) : (
                <>
                  {state?.error ? (
                    <p className="po__error" role="alert">
                      {state.error}
                    </p>
                  ) : null}
                  <SubmitOrderButton disabled={total <= 0} unavailable={Boolean(orderingNotice)} />
                </>
              )}
            </div>

            <div className="po__next">
              <div className="po__next-head">
                <Info size={18} aria-hidden />
                <h3>What happens next?</h3>
              </div>
              <ol className="po__timeline">
                {NEXT_STEPS.map((item, index) => (
                  <li key={item.title} className={index === 0 ? "is-first" : undefined}>
                    <span className="po__dot" aria-hidden />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
