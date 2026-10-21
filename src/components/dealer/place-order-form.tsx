"use client";

import "./place-order.css";
import { openSupport } from "./support-card";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  CreditCard,
  FileText,
  Fuel,
  Headphones,
  Info,
  Layers,
  MapPin,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { placeOrderAction } from "@/lib/orders/actions";
import { deliveryWindow, MAX_LITRES, typedLitres } from "@/lib/orders/order-input";

type Station = { id: string; name: string };
type WizardStep = "details" | "review";

const QUICK = [10000, 20000, 30000] as const;

const NEXT_STEPS = [
  {
    num: "01",
    icon: Package,
    title: "Order submitted",
    text: "Your request is sent to Trinity for processing.",
  },
  {
    num: "02",
    icon: FileText,
    title: "Quotation processing",
    text: "Commercial team prepares your quotation.",
  },
  {
    num: "03",
    icon: FileText,
    title: "Pro Forma Invoice (PFI)",
    text: "PFI issued for your review and payment.",
  },
  {
    num: "04",
    icon: CreditCard,
    title: "Payment confirmation",
    text: "Payment verified against your PFI.",
  },
  {
    num: "05",
    icon: Truck,
    title: "Depot & delivery",
    text: "Order released and delivery tracked to station.",
  },
] as const;

const HERO = {
  details: {
    kicker: "Place Order",
    title: "Create Fuel Order",
    copy: "Select your station, specify the required products and tell us when you need the delivery.",
  },
  review: {
    kicker: "Review Order",
    title: "Review Fuel Order",
    copy: "Confirm station, products and delivery date before submitting your order to Trinity.",
  },
} as const;

function stationArea(name: string) {
  if (name.toLowerCase().includes("nakuru")) return "Nakuru, Kenya";
  if (name.toLowerCase().includes("westlands")) return "Nairobi, Kenya";
  return "Kenya";
}

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

function stepClass(current: WizardStep, index: 1 | 2 | 3) {
  if (current === "details") return index === 1 ? "is-active" : "";
  if (current === "review") {
    if (index === 1) return "is-done";
    if (index === 2) return "is-active";
    return "";
  }
  return "";
}

function newSubmissionKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs a secure context; fall back for plain-http LAN testing.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function SubmitOrderButton({ disabled, unavailable }: { disabled: boolean; unavailable: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dp-po-submit" disabled={disabled || unavailable || pending}>
      {unavailable ? "Ordering unavailable" : pending ? "Submitting…" : "Submit Order"}
      <span>
        <ArrowRight size={18} strokeWidth={2.5} />
      </span>
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
  const [ago, setAgo] = useState(10000);
  // Nairobi's calendar day, so the default is never "yesterday" between midnight and 3am.
  const dateWindow = useMemo(() => deliveryWindow(), []);
  const [deliveryDate, setDeliveryDate] = useState(() => dateWindow.min);
  const [state, formAction] = useActionState(placeOrderAction, null);

  const station = stations.find((s) => s.id === stationId) ?? stations[0];
  const total = pms + ago;
  const summaryDate = useMemo(() => formatDisplayDate(deliveryDate), [deliveryDate]);
  const hero = HERO[step];
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

  return (
    <div className="dp-dash">
      <section
        className="dp-hero"
        style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
      >
        <div className="dp-hero__veil" />
        <div className="dp-hero__inner">
          <nav className="dp-po-crumb" aria-label="Breadcrumb">
            <Link href="/dealer/dashboard">Home</Link>
            <span className="sep">/</span>
            <Link href="/dealer/orders">Orders</Link>
            <span className="sep">/</span>
            <span className="is-current">Place Order</span>
          </nav>

          <div className="dp-po-hero__row">
            <div className="dp-po-hero__title">
              <span className="dp-po-hero__badge">
                <ShoppingCart size={22} strokeWidth={2} />
              </span>
              <div className="dp-hero__copy">
                <div className="dp-hero__kicker">{hero.kicker}</div>
                <h1>{hero.title}</h1>
                <p>{hero.copy}</p>
              </div>
            </div>
            <button type="button" className="dp-po-help" onClick={openSupport}>
              <Headphones size={16} />
              Need help?
            </button>
          </div>

          <div className={`dp-po-prog is-${step}`} aria-label="Order progress">
            <div className="dp-po-prog__track" aria-hidden="true">
              <span className="dp-po-prog__rail" />
              <span className="dp-po-prog__fill" />
            </div>

            <ol className="dp-po-prog__list">
              <li className={`dp-po-prog__item ${stepClass(step, 1)}`}>
                <span className="dp-po-prog__icon">
                  <FileText size={18} strokeWidth={2.2} />
                </span>
                <div className="dp-po-prog__card">
                  <span className="dp-po-prog__num">1</span>
                  <span className="dp-po-prog__meta">
                    <span className="dp-po-prog__title">Order Details</span>
                    <span className="dp-po-prog__desc">Select station and products</span>
                  </span>
                </div>
              </li>

              <li className={`dp-po-prog__item ${stepClass(step, 2)}`}>
                <span className="dp-po-prog__icon">
                  <FileText size={18} strokeWidth={2.2} />
                </span>
                <div className="dp-po-prog__card">
                  <span className="dp-po-prog__num">2</span>
                  <span className="dp-po-prog__meta">
                    <span className="dp-po-prog__title">Review Order</span>
                    <span className="dp-po-prog__desc">Check quantities and delivery</span>
                  </span>
                </div>
              </li>

              <li className={`dp-po-prog__item ${stepClass(step, 3)}`}>
                <span className="dp-po-prog__icon">
                  <CircleCheck size={18} strokeWidth={2.2} />
                </span>
                <div className="dp-po-prog__card">
                  <span className="dp-po-prog__num">3</span>
                  <span className="dp-po-prog__meta">
                    <span className="dp-po-prog__title">Submit Order</span>
                    <span className="dp-po-prog__desc">Confirm and place your order</span>
                  </span>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="dp-body dp-po-body">
        {orderingNotice ? (
          <div className="dp-po-notice" role="status">
            <strong>{orderingNotice.split(". ")[0]}.</strong> {orderingNotice.split(". ").slice(1).join(". ")}
          </div>
        ) : null}
        <form action={guardSubmit} className="dp-po-layout">
          <input type="hidden" name="stationId" value={stationId} />
          <input type="hidden" name="pms" value={pms} />
          <input type="hidden" name="ago" value={ago} />
          <input type="hidden" name="requestedDeliveryDate" value={deliveryDate} />
          <input type="hidden" name="submissionKey" value={submissionKey} />

          <div className="dp-po-main">
            {step === "details" ? (
              <>
                <section className="dp-po-card">
                  <header className="dp-po-card__head">
                    <span className="dp-po-num">01</span>
                    <div>
                      <h2>Station &amp; Delivery</h2>
                      <p>Select the station that will receive this order.</p>
                    </div>
                  </header>

                  <div className="dp-po-fields-row">
                    <div className="dp-po-field">
                      <label htmlFor="station-picker">Station</label>
                      <div className="dp-po-station">
                        <div
                          className="dp-po-station__thumb"
                          style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
                        />
                        <div className="dp-po-station__body">
                          <strong>{station?.name ?? "Select station"}</strong>
                          <span className="dp-po-station__status">
                            <i /> Active Station
                          </span>
                          <span className="dp-po-station__loc">
                            <MapPin size={12} />
                            {station ? stationArea(station.name) : "—"}
                          </span>
                        </div>
                        <ChevronDown size={18} className="dp-po-station__chev" />
                        <select
                          id="station-picker"
                          className="dp-po-station__select"
                          value={stationId}
                          onChange={(e) => setStationId(e.target.value)}
                          required
                        >
                          {stations.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="dp-po-field">
                      <label htmlFor="delivery-date">Requested Delivery Date</label>
                      <div className="dp-po-date">
                        <Calendar size={20} strokeWidth={1.8} />
                        <div className="dp-po-date__body">
                          <strong>{summaryDate}</strong>
                          <em>Up to {formatDisplayDate(dateWindow.max)} (current EPRA prices)</em>
                        </div>
                        <ChevronDown size={18} className="dp-po-date__chev" />
                        <input
                          id="delivery-date"
                          type="date"
                          value={deliveryDate}
                          min={dateWindow.min}
                          max={dateWindow.max}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          // The field covers the whole card; open the calendar wherever it is clicked,
                          // not only on the browser's small calendar icon.
                          onClick={(e) => {
                            try {
                              e.currentTarget.showPicker();
                            } catch {
                              // Older browsers: the native click behaviour still applies.
                            }
                          }}
                          required
                          aria-label="Requested delivery date"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="dp-po-card">
                  <header className="dp-po-card__head">
                    <span className="dp-po-num">02</span>
                    <div>
                      <h2>Fuel Requirements</h2>
                      <p>Specify the required product quantities in litres.</p>
                    </div>
                  </header>

                  <div className="dp-po-products">
                    <article className="dp-po-product is-pms">
                      <div
                        className="dp-po-product__mark"
                        style={{ backgroundImage: "url(/assets2/img/dealer/fuel-nozzle-pms.jpg)" }}
                        aria-hidden
                      />
                      <div className="dp-po-product__head">
                        <span className="dp-po-product__icon">
                          <Fuel size={18} />
                        </span>
                        <div>
                          <strong>PMS</strong>
                          <em>Premium Motor Spirit</em>
                        </div>
                      </div>
                      <div className="dp-po-qty">
                        <button
                          type="button"
                          className="dp-po-qty__btn"
                          aria-label="Decrease PMS"
                          onClick={() => setPms((v) => bumpQty(v, -1000))}
                        >
                          <Minus size={16} strokeWidth={2.5} />
                        </button>
                        <input
                          className="dp-po-qty__input"
                          aria-label="PMS litres"
                          inputMode="numeric"
                          autoComplete="off"
                          value={pms.toLocaleString("en-US")}
                          onChange={(e) => setPms(typedLitres(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          className="dp-po-qty__btn"
                          aria-label="Increase PMS"
                          onClick={() => setPms((v) => bumpQty(v, 1000))}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        <span className="dp-po-qty__unit">Litres</span>
                      </div>
                      <div className="dp-po-quick">
                        <span>Quick quantities</span>
                        <div>
                          {QUICK.map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={pms === q ? "is-on" : undefined}
                              onClick={() => setPms(q)}
                            >
                              {q.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>

                    <article className="dp-po-product is-ago">
                      <div
                        className="dp-po-product__mark"
                        style={{ backgroundImage: "url(/assets2/img/dealer/fuel-nozzle-ago.jpg)" }}
                        aria-hidden
                      />
                      <div className="dp-po-product__head">
                        <span className="dp-po-product__icon">
                          <Fuel size={18} />
                        </span>
                        <div>
                          <strong>AGO</strong>
                          <em>Automotive Gas Oil</em>
                        </div>
                      </div>
                      <div className="dp-po-qty">
                        <button
                          type="button"
                          className="dp-po-qty__btn"
                          aria-label="Decrease AGO"
                          onClick={() => setAgo((v) => bumpQty(v, -1000))}
                        >
                          <Minus size={16} strokeWidth={2.5} />
                        </button>
                        <input
                          className="dp-po-qty__input"
                          aria-label="AGO litres"
                          inputMode="numeric"
                          autoComplete="off"
                          value={ago.toLocaleString("en-US")}
                          onChange={(e) => setAgo(typedLitres(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          className="dp-po-qty__btn"
                          aria-label="Increase AGO"
                          onClick={() => setAgo((v) => bumpQty(v, 1000))}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        <span className="dp-po-qty__unit">Litres</span>
                      </div>
                      <div className="dp-po-quick">
                        <span>Quick quantities</span>
                        <div>
                          {QUICK.map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={ago === q ? "is-on" : undefined}
                              onClick={() => setAgo(q)}
                            >
                              {q.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="dp-po-total-bar">
                    <span>Total Order Volume</span>
                    <strong>{formatLitres(total)}</strong>
                  </div>

                  <div className="dp-po-info">
                    <CircleCheck size={18} />
                    <p>
                      Pricing is confirmed after your order is submitted and processed. You will
                      receive a quotation and PFI before payment is required.
                    </p>
                  </div>
                </section>
              </>
            ) : (
              <section className="dp-po-card dp-po-review">
                <header className="dp-po-review__head">
                  <div className="dp-po-review__title">
                    <span className="dp-po-num">
                      <CheckCircle2 size={16} />
                    </span>
                    <div>
                      <h2>Confirm order details</h2>
                      <p>Review your fuel order before submitting it to Trinity.</p>
                    </div>
                  </div>
                  <span className="dp-po-review__badge">
                    <i /> Ready to submit
                  </span>
                </header>

                <div className="dp-po-review__row">
                  <div className="dp-po-review__station">
                    <div
                      className="dp-po-review__thumb"
                      style={{ backgroundImage: "url(/assets2/img/dealer/hero-station.jpg)" }}
                    />
                    <div className="dp-po-review__station-body">
                      <span className="dp-po-review__ico is-blue">
                        <MapPin size={15} />
                      </span>
                      <div>
                        <span className="dp-po-review__label">Station</span>
                        <strong>{station?.name ?? "—"}</strong>
                        <em className="dp-po-review__active">
                          <i /> Active Station
                        </em>
                        <em className="dp-po-review__loc">
                          <MapPin size={12} />
                          {station ? stationArea(station.name) : "—"}
                        </em>
                      </div>
                    </div>
                  </div>

                  <div className="dp-po-review__delivery">
                    <span className="dp-po-review__ico is-blue">
                      <Calendar size={15} />
                    </span>
                    <div>
                      <span className="dp-po-review__label">Requested delivery</span>
                      <strong>{summaryDate}</strong>
                      <em>Requested delivery date</em>
                    </div>
                  </div>
                </div>

                <div className="dp-po-review__row">
                  <div className="dp-po-review__fuel is-pms">
                    <div
                      className="dp-po-review__mark"
                      style={{ backgroundImage: "url(/assets2/img/dealer/fuel-drop-pms.jpg)" }}
                      aria-hidden
                    />
                    <span className="dp-po-review__fuel-ico">
                      <Fuel size={18} />
                    </span>
                    <div className="dp-po-review__fuel-copy">
                      <strong>PMS</strong>
                      <em>Premium Motor Spirit</em>
                      <b>{pms > 0 ? formatLitres(pms) : "—"}</b>
                    </div>
                  </div>

                  <div className="dp-po-review__fuel is-ago">
                    <div
                      className="dp-po-review__mark"
                      style={{ backgroundImage: "url(/assets2/img/dealer/fuel-pump-ago.jpg)" }}
                      aria-hidden
                    />
                    <span className="dp-po-review__fuel-ico">
                      <Fuel size={18} />
                    </span>
                    <div className="dp-po-review__fuel-copy">
                      <strong>AGO</strong>
                      <em>Automotive Gas Oil</em>
                      <b>{ago > 0 ? formatLitres(ago) : "—"}</b>
                    </div>
                  </div>
                </div>

                <div className="dp-po-total-bar is-review">
                  <div className="dp-po-total-bar__left">
                    <Layers size={26} strokeWidth={2} />
                    <div>
                      <span>Total order volume</span>
                      <em>
                        {pms > 0 ? `PMS ${formatLitres(pms)}` : null}
                        {pms > 0 && ago > 0 ? " • " : null}
                        {ago > 0 ? `AGO ${formatLitres(ago)}` : null}
                        {pms <= 0 && ago <= 0 ? "No products selected" : null}
                      </em>
                    </div>
                  </div>
                  <strong>{formatLitres(total)}</strong>
                </div>

                <div className="dp-po-info is-review">
                  <Info size={26} strokeWidth={2} />
                  <p>
                    <b>Ready to submit.</b> Once submitted, this order will be sent to Trinity for
                    quotation processing. You can monitor its progress from My Orders.
                  </p>
                </div>

                <button type="button" className="dp-po-back" onClick={goToDetails}>
                  <ArrowLeft size={16} />
                  Edit order details
                </button>
              </section>
            )}
          </div>

          <aside className="dp-po-aside">
            <div className="dp-po-summary">
              <div className="dp-po-summary__head">
                <FileText size={18} />
                <h3>Order Summary</h3>
              </div>
              <dl>
                <div>
                  <dt>Station</dt>
                  <dd>{station?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Requested Delivery</dt>
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
              <div className="dp-po-summary__total">
                <span>Total Volume</span>
                <strong>{formatLitres(total)}</strong>
              </div>

              {step === "details" ? (
                <button
                  type="button"
                  className="dp-po-submit"
                  disabled={!canReview}
                  onClick={goToReview}
                >
                  Review Order
                  <span>
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </span>
                </button>
              ) : (
                <>
                  {state?.error ? (
                    <p className="dp-po-error" role="alert">
                      {state.error}
                    </p>
                  ) : null}
                  <SubmitOrderButton disabled={total <= 0} unavailable={Boolean(orderingNotice)} />
                </>
              )}
            </div>

            <div className="dp-po-next">
              <h3>What happens next?</h3>
              <ol>
                {NEXT_STEPS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.num}>
                      <span className="dp-po-next__num">{item.num}</span>
                      <Icon size={16} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </form>
      </section>
    </div>
  );
}
