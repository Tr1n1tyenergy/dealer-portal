"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  startTransition,
  useActionState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronUp,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Info,
  Shield,
  X,
} from "lucide-react";
import { paymentAction } from "@/lib/orders/actions";
import { PFI_BANK_ACCOUNTS, PFI_COMPANY } from "@/lib/company/pfi-settings";
import { formatMoney } from "@/lib/orders/pfi-totals";
import "./pay-pfi-panel.css";

/** Optional “your bank” list — labels only; not a payment-rail integration. */
const DEALER_BANK_OPTIONS = [
  "Absa Bank Kenya",
  "Bank of Africa",
  "Co-operative Bank",
  "Diamond Trust Bank",
  "Equity Bank",
  "Family Bank",
  "I&M Bank",
  "KCB Bank",
  "NCBA Bank",
  "Stanbic Bank",
  "Standard Chartered",
] as const;

export type PayPfiPanelProps = {
  orderId: string;
  orderReference: string;
  pfiNumber: string | null;
  stationName: string;
  organizationName: string;
  amountDue: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  vatRate: string | null;
  /** `inline` sits in hero action rows; `bar` is a left-aligned strip under the shell header. */
  variant?: "inline" | "bar";
};

type BankAccount = (typeof PFI_BANK_ACCOUNTS)[number];

function bankShortName(bank: BankAccount) {
  if (bank.bank.toUpperCase().includes("KCB")) return "KCB";
  if (bank.bank.toUpperCase().includes("EQUITY")) return "EQUITY";
  return bank.bank.split(" ")[0] ?? "Bank";
}

function bankLogoClass(bank: BankAccount) {
  if (bank.bank.toUpperCase().includes("KCB")) return "is-kcb";
  if (bank.bank.toUpperCase().includes("EQUITY")) return "is-equity";
  return "is-generic";
}

/** Pulsating Pay CTA + Pay PFI modal (existing paymentAction). */
export function PayPfiPanel(props: PayPfiPanelProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const variant = props.variant ?? "inline";

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const eligible = Boolean(props.amountDue && props.pfiNumber && PFI_BANK_ACCOUNTS.length > 0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <div className={`pay-cta pay-cta--${variant}`}>
        <button
          ref={triggerRef}
          type="button"
          className={`pay-cta__btn ${open ? "is-open" : ""}`}
          onClick={() => setOpen(true)}
          disabled={!eligible}
          title={eligible ? undefined : "Payment is not available for this order yet"}
        >
          Pay for this PFI
          <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      {mounted && open
        ? createPortal(
            <PayPfiModal {...props} titleId={titleId} onClose={close} eligible={eligible} />,
            document.body,
          )
        : null}
    </>
  );
}

function PayPfiModal({
  orderId,
  orderReference,
  pfiNumber,
  stationName,
  organizationName,
  amountDue,
  subtotal,
  vatAmount,
  vatRate,
  titleId,
  onClose,
  eligible,
}: PayPfiPanelProps & { titleId: string; onClose: () => void; eligible: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"instruct" | "confirm">("instruct");
  const [method, setMethod] = useState<"bank" | "card">("bank");
  const [bankIndex, setBankIndex] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [copied, setCopied] = useState(false);
  const [yourBank, setYourBank] = useState("");
  const [state, formAction, pending] = useActionState(paymentAction, null);
  const [attempted, setAttempted] = useState(false);

  const amountLabel = amountDue ? `KES ${formatMoney(amountDue)}` : null;
  const vatPct =
    vatRate && Number.isFinite(Number(vatRate))
      ? `${Math.round(Number(vatRate) * 100)}%`
      : null;
  const selectedBank = PFI_BANK_ACCOUNTS[bankIndex];
  const paymentReference = pfiNumber ?? "";
  const hasBreakdown = Boolean(subtotal && vatAmount && amountDue);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusable = root.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [phase]);

  useEffect(() => {
    if (attempted && !pending && state === null) onClose();
  }, [attempted, pending, state, onClose]);

  async function copyReference() {
    if (!paymentReference) return;
    try {
      await navigator.clipboard.writeText(paymentReference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function onConfirmSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!amountDue || !selectedBank || !paymentReference) return;
    setAttempted(true);
    const data = new FormData(e.currentTarget);
    data.set("orderId", orderId);
    data.set("amount", amountDue);
    data.set("bankReference", paymentReference);
    const noteParts = [
      `Paid to ${selectedBank.bank} ${selectedBank.accountNumber}`,
      yourBank ? `From ${yourBank}` : null,
      String(data.get("note") || "").trim() || null,
    ].filter(Boolean);
    data.set("note", noteParts.join(" · "));
    startTransition(() => formAction(data));
  }

  return (
    <div className="pay-modal" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="pay-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="pay-modal__close" onClick={onClose} aria-label="Close payment dialog">
          <X size={18} strokeWidth={2.2} />
        </button>

        <header className="pay-modal__head">
          <span className="pay-modal__head-ico" aria-hidden>
            <FileText size={22} strokeWidth={2.15} />
          </span>
          <div className="pay-modal__head-copy">
            <h2 id={titleId}>Pay PFI</h2>
            <p className="pay-modal__ids">
              <strong>{orderReference}</strong>
              {pfiNumber ? (
                <>
                  <span aria-hidden> · </span>
                  <strong>{pfiNumber}</strong>
                </>
              ) : null}
            </p>
            <p className="pay-modal__meta">
              {stationName} · {organizationName}
            </p>
          </div>
        </header>

        <div className="pay-modal__rule" aria-hidden />

        {!eligible || !amountLabel || !selectedBank ? (
          <p className="pay-modal__error" role="alert">
            Payment cannot continue: this order is missing a valid PFI amount or verified Trinity bank
            accounts.
          </p>
        ) : phase === "instruct" ? (
          <>
            <section className="pay-modal__amount" aria-label="Amount due">
              <div className="pay-modal__amount-left">
                <span className="pay-modal__amount-label">Amount due</span>
                <strong className="pay-modal__amount-value">{amountLabel}</strong>
                <p className="pay-modal__amount-note">
                  <Info size={14} strokeWidth={2.2} aria-hidden />
                  This amount is taken from your Pro Forma Invoice and cannot be changed.
                </p>
              </div>

              <div className="pay-modal__amount-right">
                <button
                  type="button"
                  className="pay-modal__breakdown-toggle"
                  onClick={() => setShowBreakdown((v) => !v)}
                  aria-expanded={showBreakdown}
                >
                  View breakdown
                  <ChevronUp
                    size={15}
                    className={showBreakdown ? "is-open" : ""}
                    aria-hidden
                  />
                </button>
                {showBreakdown && hasBreakdown ? (
                  <dl className="pay-modal__breakdown">
                    <div>
                      <dt>Subtotal</dt>
                      <dd>KES {formatMoney(subtotal!)}</dd>
                    </div>
                    <div>
                      <dt>{vatPct ? `VAT (${vatPct})` : "VAT"}</dt>
                      <dd>KES {formatMoney(vatAmount!)}</dd>
                    </div>
                    <div className="is-total">
                      <dt>Total (VAT Incl.)</dt>
                      <dd>KES {formatMoney(amountDue!)}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </section>

            <h3 className="pay-modal__section-title">Choose payment method</h3>
            <div className="pay-modal__methods" role="radiogroup" aria-label="Payment method">
              <button
                type="button"
                className={`pay-modal__method ${method === "bank" ? "is-on" : ""}`}
                onClick={() => setMethod("bank")}
                aria-checked={method === "bank"}
                role="radio"
              >
                <span className="pay-modal__method-ico" aria-hidden>
                  <Building2 size={18} strokeWidth={2.1} />
                </span>
                <span className="pay-modal__method-copy">
                  <strong>Bank transfer</strong>
                  <em>Bank-to-bank payment</em>
                </span>
                <i className="pay-modal__radio" aria-hidden />
              </button>
              <button
                type="button"
                className={`pay-modal__method is-unavailable ${method === "card" ? "is-on" : ""}`}
                onClick={() => setMethod("card")}
                aria-checked={method === "card"}
                role="radio"
              >
                <span className="pay-modal__method-ico" aria-hidden>
                  <CreditCard size={18} strokeWidth={2.1} />
                </span>
                <span className="pay-modal__method-copy">
                  <strong>Card</strong>
                  <em>Pay with credit or debit card</em>
                </span>
                <i className="pay-modal__radio" aria-hidden />
              </button>
            </div>

            {method === "card" ? (
              <p className="pay-modal__card-note" role="status">
                Card payments are not available in the dealer portal yet. Please use bank transfer.
              </p>
            ) : (
              <section className="pay-modal__bank-panel">
                <p className="pay-modal__bank-lead">
                  <Building2 size={16} strokeWidth={2.2} aria-hidden />
                  Pay exactly <strong>{amountLabel}</strong> to one of Trinity&apos;s accounts.
                </p>

                <p className="pay-modal__field-label">
                  Select the account you are paying to <span aria-hidden>*</span>
                </p>
                <div className="pay-modal__banks" role="radiogroup" aria-label="Trinity bank account">
                  {PFI_BANK_ACCOUNTS.map((bank, index) => (
                    <button
                      key={bank.accountNumber}
                      type="button"
                      role="radio"
                      aria-checked={bankIndex === index}
                      className={`pay-modal__bank ${bankIndex === index ? "is-on" : ""}`}
                      onClick={() => setBankIndex(index)}
                    >
                      <i className="pay-modal__radio" aria-hidden />
                      <span className={`pay-modal__bank-logo ${bankLogoClass(bank)}`} aria-hidden>
                        {bankShortName(bank)}
                      </span>
                      <span className="pay-modal__bank-divider" aria-hidden />
                      <span className="pay-modal__bank-copy">
                        <strong>{bank.beneficiary}</strong>
                        <em>{bank.accountNumber}</em>
                      </span>
                      {bankIndex === index ? (
                        <Check className="pay-modal__bank-check" size={16} strokeWidth={2.6} aria-hidden />
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="pay-modal__fields">
                  <label className="pay-modal__field">
                    <span>
                      Payment reference <span aria-hidden>*</span>
                    </span>
                    <span className="pay-modal__ref">
                      <input
                        value={paymentReference}
                        readOnly
                        aria-readonly="true"
                        name="paymentReferenceDisplay"
                      />
                      <button
                        type="button"
                        className="pay-modal__copy"
                        onClick={copyReference}
                        aria-label="Copy payment reference"
                        title="Copy reference"
                      >
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </span>
                  </label>

                  <label className="pay-modal__field">
                    <span>Your bank (optional)</span>
                    <select
                      value={yourBank}
                      onChange={(e) => setYourBank(e.target.value)}
                      aria-label="Your bank"
                    >
                      <option value="">Select your bank</option>
                      {DEALER_BANK_OPTIONS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            )}

            <footer className="pay-modal__foot">
              <div className="pay-modal__trust">
                <Shield size={18} strokeWidth={2.1} aria-hidden />
                <div>
                  <strong>You&apos;ll pay {PFI_COMPANY.name.replace(/LIMITED$/i, "Limited")}.</strong>
                  <span>Amount matches your PFI.</span>
                  <a href={`/api/orders/${orderId}/pfi`} target="_blank" rel="noopener">
                    View PFI PDF
                    <ExternalLink size={13} strokeWidth={2.2} aria-hidden />
                  </a>
                </div>
              </div>
              <div className="pay-modal__actions">
                <button type="button" className="pay-modal__cancel" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="pay-modal__submit"
                  disabled={method !== "bank" || !paymentReference}
                  onClick={() => setPhase("confirm")}
                >
                  Continue to bank payment
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <form className="pay-modal__confirm" onSubmit={onConfirmSubmit}>
            <p className="pay-modal__confirm-lead">
              Transfer <strong>{amountLabel}</strong> to{" "}
              <strong>{selectedBank.bank}</strong> account{" "}
              <strong>{selectedBank.accountNumber}</strong> using reference{" "}
              <strong>{paymentReference}</strong>, then enter your transfer details below for Trinity
              finance to verify.
            </p>

            <label className="pay-modal__field">
              <span>Transaction reference</span>
              <input
                name="transactionReference"
                maxLength={100}
                placeholder="Bank / transfer reference"
                required
              />
            </label>
            <label className="pay-modal__field">
              <span>Payment date</span>
              <input name="paymentDate" type="date" required />
            </label>
            <label className="pay-modal__field">
              <span>Note (optional)</span>
              <textarea name="note" rows={2} maxLength={500} />
            </label>

            {state?.error ? (
              <p className="pay-modal__error" role="alert">
                {state.error}
              </p>
            ) : null}

            <footer className="pay-modal__foot">
              <button type="button" className="pay-modal__cancel" onClick={() => setPhase("instruct")}>
                Back
              </button>
              <div className="pay-modal__actions">
                <button type="button" className="pay-modal__cancel" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="pay-modal__submit" disabled={pending}>
                  {pending ? "Submitting…" : "Submit for verification"}
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
