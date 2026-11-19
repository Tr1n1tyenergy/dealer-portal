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
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Check,
  ChevronUp,
  ExternalLink,
  FileText,
  Shield,
  Smartphone,
  X,
} from "lucide-react";
import { checkMpesaCodeAction, paymentAction } from "@/lib/orders/actions";
import { MPESA_MAX_PER_PAYMENT, MPESA_PAYBILL, PFI_BANK_ACCOUNTS, PFI_COMPANY } from "@/lib/company/pfi-settings";
import { formatMoney } from "@/lib/orders/pfi-totals";
import { parseSafaricomPhone, toCents } from "@/lib/orders/payments";
import "./pay-pfi-panel.css";

export type PayPfiPanelProps = {
  orderId: string;
  orderReference: string;
  pfiNumber: string | null;
  stationName: string;
  organizationName: string;
  /** PFI total incl. VAT, and what is confirmed, waiting for confirmation and left to pay ("1234.50"). */
  totalAmount: string;
  paidAmount: string;
  waitingAmount: string;
  balance: string;
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

  const eligible = Boolean(toCents(props.balance) && PFI_BANK_ACCOUNTS.length > 0);
  const started = (toCents(props.paidAmount) ?? 0) + (toCents(props.waitingAmount) ?? 0) > 0;
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
          {started ? "Pay balance" : "Pay for this PFI"}
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

type Method = "mpesa" | "manual";
type Found = { amount: string; date: string };

const kes = (amount: string) => `KES ${formatMoney(amount)}`;

function PayPfiModal({
  orderId,
  orderReference,
  pfiNumber,
  stationName,
  organizationName,
  totalAmount,
  paidAmount,
  waitingAmount,
  balance,
  subtotal,
  vatAmount,
  vatRate,
  titleId,
  onClose,
  eligible,
}: PayPfiPanelProps & { titleId: string; onClose: () => void; eligible: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState<Method>("manual");
  const [bankIndex, setBankIndex] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [state, formAction, pending] = useActionState(paymentAction, null);
  const [attempted, setAttempted] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  // M-PESA
  const [phone, setPhone] = useState("");
  const balanceCents = toCents(balance) ?? 0;
  const mpesaMaxCents = Math.min(balanceCents, MPESA_MAX_PER_PAYMENT * 100);
  const [promptAmount, setPromptAmount] = useState((mpesaMaxCents / 100).toFixed(2));
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const paidCents = toCents(paidAmount) ?? 0;
  const waitingCents = toCents(waitingAmount) ?? 0;
  const totalCents = toCents(totalAmount) ?? 0;
  const pct = (cents: number) => `${totalCents ? Math.min(100, (cents / totalCents) * 100) : 0}%`;
  const vatPct = vatRate && Number.isFinite(Number(vatRate)) ? `${Math.round(Number(vatRate) * 100)}%` : null;
  const hasBreakdown = Boolean(subtotal && vatAmount);
  const done = attempted && !pending && state === null;

  useEffect(() => {
    const root = dialogRef.current;
    const focusable = root?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [done]);

  const phoneCheck = phone ? parseSafaricomPhone(phone) : null;
  const promptCents = toCents(promptAmount);
  const promptAmountError =
    promptCents == null || promptCents < 100 || promptCents > mpesaMaxCents
      ? `Enter an amount between KES 1 and ${kes((mpesaMaxCents / 100).toFixed(2))}.`
      : null;

  async function checkCode() {
    setChecking(true);
    setFound(null);
    setCodeError(null);
    const result = await checkMpesaCodeAction(code);
    setChecking(false);
    if (!result.ok) setCodeError(result.error);
    else if ((toCents(result.amount) ?? 0) > balanceCents)
      setCodeError(`This payment is more than the balance of ${kes(balance)}. Contact Trinity.`);
    else setFound({ amount: result.amount, date: result.date });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const data = new FormData(e.currentTarget);
    data.set("orderId", orderId);
    if (method === "mpesa") {
      if (!found) return setClientError("Check your M-PESA code first.");
      data.set("method", "MPESA_CODE");
      data.set("mpesaCode", code);
    } else {
      const cents = toCents(String(data.get("amount") || ""));
      if (!String(data.get("bankReference") || "").trim()) return setClientError("Enter the bank reference from your bank.");
      if (cents == null || cents <= 0) return setClientError("Enter the amount you paid.");
      if (cents > balanceCents) return setClientError(`This is more than the balance of ${kes(balance)}.`);
      data.set("method", "MANUAL");
      data.set("bankAccountNumber", PFI_BANK_ACCOUNTS[bankIndex].accountNumber);
    }
    setAttempted(true);
    startTransition(() => formAction(data));
  }

  const error = clientError ?? state?.error ?? null;

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

        {!eligible ? (
          <p className="pay-modal__error" role="alert">
            There is nothing left to pay on this PFI.
          </p>
        ) : done ? (
          <section className="pay-modal__done" role="status">
            <span className="pay-modal__done-ico" aria-hidden>
              <Check size={22} strokeWidth={2.6} />
            </span>
            <p>
              <strong>Payment sent to Trinity for confirmation.</strong>
              <span>You&apos;ll see it as confirmed once checked.</span>
            </p>
            <button type="button" className="pay-modal__submit" onClick={onClose}>
              Done
            </button>
          </section>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <section className="pay-modal__amount pay-modal__amount--balance" aria-label="Balance to pay">
              <div className="pay-modal__amount-left">
                <span className="pay-modal__amount-label">Balance to pay</span>
                <strong className="pay-modal__amount-value">{kes(balance)}</strong>
              </div>
              <div className="pay-modal__amount-right">
                <button
                  type="button"
                  className="pay-modal__breakdown-toggle"
                  onClick={() => setShowBreakdown((v) => !v)}
                  aria-expanded={showBreakdown}
                >
                  PFI total {kes(totalAmount)}
                  <ChevronUp size={15} className={showBreakdown ? "is-open" : ""} aria-hidden />
                </button>
                {showBreakdown && hasBreakdown ? (
                  <dl className="pay-modal__breakdown">
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{kes(subtotal!)}</dd>
                    </div>
                    <div>
                      <dt>{vatPct ? `VAT (${vatPct})` : "VAT"}</dt>
                      <dd>{kes(vatAmount!)}</dd>
                    </div>
                    <div className="is-total">
                      <dt>Total (VAT Incl.)</dt>
                      <dd>{kes(totalAmount)}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
              {paidCents + waitingCents > 0 ? (
                <>
                  <span className="pay-modal__progress" aria-hidden>
                    <i className="is-paid" style={{ width: pct(paidCents) }} />
                    <i className="is-waiting" style={{ width: pct(waitingCents) }} />
                  </span>
                  <p className="pay-modal__split">
                    <span>
                      <b>Paid so far</b> {kes(paidAmount)}
                    </span>
                    <span>
                      <b>Waiting for confirmation</b> {kes(waitingAmount)}
                    </span>
                  </p>
                </>
              ) : null}
            </section>

            <h3 className="pay-modal__section-title">Choose payment method</h3>
            <div className="pay-modal__methods pay-modal__methods--three" role="radiogroup" aria-label="Payment method">
              <button
                type="button"
                role="radio"
                aria-checked={method === "mpesa"}
                className={`pay-modal__method ${method === "mpesa" ? "is-on" : ""}`}
                onClick={() => setMethod("mpesa")}
              >
                <span className="pay-modal__method-ico pay-modal__method-ico--mpesa" aria-hidden>
                  M-PESA
                </span>
                <span className="pay-modal__method-copy">
                  <strong>M-PESA</strong>
                  <em>Any amount</em>
                </span>
                <i className="pay-modal__radio" aria-hidden />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={method === "manual"}
                className={`pay-modal__method ${method === "manual" ? "is-on" : ""}`}
                onClick={() => setMethod("manual")}
              >
                <span className="pay-modal__method-ico" aria-hidden>
                  <Building2 size={18} strokeWidth={2.1} />
                </span>
                <span className="pay-modal__method-copy">
                  <strong>Manual payment</strong>
                  <em>Enter bank reference</em>
                </span>
                <i className="pay-modal__radio" aria-hidden />
              </button>
              <div className="pay-modal__method is-soon" aria-disabled="true">
                <span className="pay-modal__soon">Coming soon</span>
                <span className="pay-modal__method-ico" aria-hidden>
                  <ArrowLeftRight size={18} strokeWidth={2.1} />
                </span>
                <span className="pay-modal__method-copy">
                  <strong>Bank transfer</strong>
                  <em>Direct from your bank</em>
                </span>
              </div>
            </div>

            {method === "mpesa" ? (
              <section className="pay-modal__bank-panel" aria-label="M-PESA">
                <p className="pay-modal__bank-lead">
                  <Smartphone size={16} strokeWidth={2.2} aria-hidden />
                  Pay with a prompt on your phone
                </p>
                <div className="pay-modal__fields">
                  <label className="pay-modal__field">
                    <span>
                      M-PESA phone number <span aria-hidden>*</span>
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="07XX XXX XXX"
                      aria-invalid={phoneCheck?.ok === false}
                    />
                    {phoneCheck?.ok === false ? <small className="pay-modal__hint is-bad">{phoneCheck.message}</small> : null}
                  </label>
                  <label className="pay-modal__field">
                    <span>
                      Amount to pay <span aria-hidden>*</span>
                    </span>
                    <input
                      value={promptAmount}
                      onChange={(e) => setPromptAmount(e.target.value)}
                      inputMode="decimal"
                      aria-invalid={Boolean(promptAmountError)}
                    />
                    <small className={`pay-modal__hint ${promptAmountError ? "is-bad" : ""}`}>
                      {promptAmountError ?? `Up to ${kes(MPESA_MAX_PER_PAYMENT.toFixed(2))} per M-PESA payment`}
                    </small>
                  </label>
                </div>
                <div className="pay-modal__inline">
                  <button type="button" className="pay-modal__cancel" disabled>
                    Send payment prompt
                  </button>
                  <p className="pay-modal__hint">
                    M-PESA prompts are being set up. For now, pay to the paybill and enter the M-PESA code below.
                  </p>
                </div>

                <p className="pay-modal__or">or</p>
                <p className="pay-modal__bank-lead">
                  Already paid by M-PESA?
                  {MPESA_PAYBILL ? (
                    <span className="pay-modal__hint">
                      Paybill {MPESA_PAYBILL} · Account {pfiNumber ?? orderReference}
                    </span>
                  ) : null}
                </p>
                <div className="pay-modal__inline">
                  <label className="pay-modal__field">
                    <span>
                      M-PESA code <span aria-hidden>*</span>
                    </span>
                    <input
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setFound(null);
                        setCodeError(null);
                      }}
                      maxLength={12}
                      autoCapitalize="characters"
                      placeholder="e.g. TKJ4AB12CD"
                    />
                  </label>
                  <button type="button" className="pay-modal__cancel" onClick={checkCode} disabled={checking || code.trim().length < 10}>
                    {checking ? "Checking…" : "Check code"}
                  </button>
                </div>
                {found ? (
                  <p className="pay-modal__found" role="status">
                    <span className="pay-modal__found-chip">
                      <Check size={14} strokeWidth={2.6} aria-hidden /> Found
                    </span>
                    <span>
                      <b>{kes(found.amount)}</b> paid {found.date}. Ready to send to Trinity.
                    </span>
                  </p>
                ) : null}
                {codeError ? (
                  <p className="pay-modal__error" role="alert">
                    {codeError}
                  </p>
                ) : null}
              </section>
            ) : (
              <section className="pay-modal__bank-panel" aria-label="Manual payment">
                <label className="pay-modal__field">
                  <span>
                    Once you have paid, enter the bank reference number here <span aria-hidden>*</span>
                  </span>
                  <input name="bankReference" maxLength={60} autoComplete="off" required />
                  {pfiNumber ? (
                    <small className="pay-modal__hint">
                      Tip: put <b>{pfiNumber}</b> as the narration on your transfer.
                    </small>
                  ) : null}
                </label>

                <p className="pay-modal__field-label">
                  Choose which bank account you paid to <span aria-hidden>*</span>
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

                <label className="pay-modal__field">
                  <span>
                    Amount paid <span aria-hidden>*</span>
                  </span>
                  <input name="amount" defaultValue={formatMoney(balance)} inputMode="decimal" required />
                  <small className="pay-modal__hint">Filled with the balance. Change it if you paid part of it.</small>
                </label>
              </section>
            )}

            {error ? (
              <p className="pay-modal__error" role="alert">
                {error}
              </p>
            ) : null}

            <footer className="pay-modal__foot">
              <div className="pay-modal__trust">
                <Shield size={18} strokeWidth={2.1} aria-hidden />
                <div>
                  <strong>You&apos;ll pay {PFI_COMPANY.name.replace(/LIMITED$/i, "Limited")}.</strong>
                  <span>Trinity confirms each payment.</span>
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
                  type="submit"
                  className="pay-modal__submit"
                  disabled={pending || (method === "mpesa" && !found)}
                >
                  {pending ? "Submitting…" : "Submit payment"}
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
