"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  CreditCard,
  Hash,
  Landmark,
  Scale,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PendingSubmit } from "@/components/staff/pending-submit";
import { internalOrderAction } from "@/lib/orders/actions";
import { parseReceiptEdits, type ReceiptJournal } from "@/lib/orders/receipt-preview";

export type ReceiptCurrency = { id: number; code: string };

const ICONS: Record<string, LucideIcon> = {
  "Internal Transfer": ArrowLeftRight,
  "Payment Type": ArrowDownLeft,
  Customer: UserRound,
  Amount: Banknote,
  Currency: Coins,
  Date: Calendar,
  "Bank Reference": Hash,
  Journal: Landmark,
  "Payment Method": Wallet,
  "Company Bank Account": Building2,
};

function grouped(amount: string) {
  const clean = amount.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return { cents, text: (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
}

function kes(cents: number) {
  return `KES ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentReviewEditor({
  orderId,
  paymentId,
  back,
  open,
  mayAct,
  automatic,
  customerLinked,
  dealerName,
  sentOn,
  submitterName,
  dealerNote,
  methodLabel,
  accountingDate,
  amount,
  bankReference,
  journalId,
  currencyId,
  journals,
  currencies,
  totalCents,
  confirmedCents,
  otherWaitingCents,
  odooError,
  issues,
  dateNote,
  mappingNote,
}: {
  orderId: string;
  paymentId: string;
  back: string;
  open: boolean;
  mayAct: boolean;
  automatic: boolean;
  customerLinked: boolean;
  dealerName: string;
  sentOn: string;
  submitterName: string | null;
  dealerNote: string | null;
  methodLabel: string;
  accountingDate: string;
  amount: string;
  bankReference: string;
  journalId: number;
  currencyId: number;
  journals: ReceiptJournal[];
  currencies: ReceiptCurrency[];
  totalCents: number | null;
  confirmedCents: number;
  otherWaitingCents: number;
  odooError: string | null;
  issues: string[];
  dateNote: string;
  mappingNote: string;
}) {
  const [draftAmount, setDraftAmount] = useState(amount);
  const [draftReference, setDraftReference] = useState(bankReference);
  const [draftJournalId, setDraftJournalId] = useState(journalId);
  const [draftCurrencyId, setDraftCurrencyId] = useState(currencyId);

  const journal = journals.find((item) => item.journalId === draftJournalId) ?? journals[0];
  const currency = currencies.find((item) => item.id === draftCurrencyId) ?? currencies[0];
  const money = grouped(draftAmount);
  const edited = parseReceiptEdits({
    amount: draftAmount,
    reference: draftReference,
    journalId: journal?.journalId ?? 0,
    currencyId: currency?.id ?? 0,
  });
  const thisCents = money?.cents ?? 0;
  const waitingCents = otherWaitingCents + (open ? thisCents : 0);
  const projected = totalCents == null ? null : Math.max(0, totalCents - confirmedCents - (open ? thisCents : 0));
  const amountLabel = money ? (currency?.code === "KES" ? `KES ${money.text}` : `${currency?.code ?? ""} ${money.text}`) : draftAmount || "—";
  const postReady = automatic && edited.ok && customerLinked;

  return (
    <>
      <div className="spr-kpis">
        <article className="spr-kpi">
          <span className="spr-kpi__ico spr-kpi__ico--blue" aria-hidden><CreditCard size={16} strokeWidth={1.75} /></span>
          <span className="spr-kpi__label">PFI total</span>
          <strong>{totalCents == null ? "—" : kes(totalCents)}</strong>
        </article>
        <article className="spr-kpi">
          <span className="spr-kpi__ico spr-kpi__ico--green" aria-hidden><CheckCircle2 size={16} strokeWidth={1.75} /></span>
          <span className="spr-kpi__label">Confirmed</span>
          <strong>{kes(confirmedCents)}</strong>
        </article>
        <article className="spr-kpi">
          <span className="spr-kpi__ico spr-kpi__ico--amber" aria-hidden><Clock size={16} strokeWidth={1.75} /></span>
          <span className="spr-kpi__label">Waiting</span>
          <strong>{kes(waitingCents)}</strong>
        </article>
        <article className="spr-kpi">
          <span className="spr-kpi__ico spr-kpi__ico--violet" aria-hidden><Scale size={16} strokeWidth={1.75} /></span>
          <span className="spr-kpi__label">Balance if confirmed</span>
          <strong>{projected == null ? "—" : kes(projected)}</strong>
        </article>
      </div>

      <div className="spr-cols">
        <section className="spr-card">
          <header className="spr-card__head">
            <span className="spr-card__mark" aria-hidden><Landmark size={16} strokeWidth={1.75} /></span>
            <div>
              <h2>Payment Details</h2>
              <p>Details of the dealer payment you are about to confirm.</p>
            </div>
          </header>
          <dl className="spr-facts">
            <div>
              <dt>Payment Amount</dt>
              <dd className="spr-amount">
                <strong>{amountLabel}</strong>
                <span className="sod-paycard__method">{methodLabel}</span>
              </dd>
            </div>
            <div>
              <dt>Paid by</dt>
              <dd>{dealerName}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{journal ? `${journal.bank} · ${journal.accountNumber}` : "Not recorded"}</dd>
            </div>
            <div>
              <dt>Bank Reference</dt>
              <dd>{draftReference.trim() || "Not provided"}</dd>
            </div>
            <div>
              <dt>Sent On</dt>
              <dd>{sentOn}</dd>
            </div>
            {submitterName ? (
              <div>
                <dt>Submitted by</dt>
                <dd>{submitterName}</dd>
              </div>
            ) : null}
          </dl>
          {dealerNote ? <p className="spr-dealer-note">{dealerNote}</p> : null}
          {open && mayAct ? (
            <form action={internalOrderAction} className="spr-flag">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="paymentId" value={paymentId} />
              <input type="hidden" name="returnTo" value={back} />
              <label>
                <span>Note for the payment record</span>
                <input name="note" type="text" maxLength={300} placeholder="Optional note if you flag this payment" />
              </label>
              <PendingSubmit className="spr-flag__btn" pendingLabel="Flagging…">Flag payment</PendingSubmit>
              <input type="hidden" name="action" value="reject-payment" />
            </form>
          ) : null}
          {!open ? <p className="spr-status">This payment is already reviewed.</p> : null}
          {!mayAct ? <p className="spr-status">Your role can view this payment but not confirm or flag it.</p> : null}
        </section>

        <section className="spr-card">
          <header className="spr-card__head">
            <span className="spr-odoo" aria-hidden>odoo</span>
            <div>
              <h2>Accounts (Odoo) Receipt Mapping</h2>
              <p>{mappingNote}</p>
            </div>
          </header>
          {odooError ? <p className="spr-warn">{odooError}</p> : null}
          {issues.length > 0 && open ? (
            <ul className="spr-warns">
              {issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          ) : null}
          <p className="spr-date-note">{dateNote}</p>
          <form action={internalOrderAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="paymentId" value={paymentId} />
            <input type="hidden" name="returnTo" value={back} />
            <input type="hidden" name="receiptEdit" value="1" />
            <input type="hidden" name="action" value="confirm-payment" />
            <div className="spr-map" role="table" aria-label="Odoo receipt mapping">
              <MapRow label="Internal Transfer" value="No" tone="pill" />
              <MapRow label="Payment Type" value="Receive" tone="good" />
              <MapRow label="Customer" value={customerLinked ? dealerName : "Not linked to an Odoo customer"} tone={customerLinked ? "plain" : "bad"} />
              <MapRow label="Amount">
                <input className="spr-map__input" name="amount" inputMode="decimal" value={draftAmount} onChange={(event) => setDraftAmount(event.target.value)} aria-label="Amount" />
              </MapRow>
              <MapRow label="Currency">
                <span className="spr-map__pick">
                  <span className="spr-map__pick-text" aria-hidden>{currency?.code ?? ""}</span>
                  <ChevronDown size={14} strokeWidth={2} aria-hidden />
                  <select className="spr-map__input spr-map__pick-select" name="currencyId" value={currency?.id ?? ""} onChange={(event) => setDraftCurrencyId(Number(event.target.value))} aria-label="Currency">
                    {currencies.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                  </select>
                </span>
              </MapRow>
              <MapRow label="Date" value={accountingDate} />
              <MapRow label="Bank Reference">
                <input className="spr-map__input" name="bankReference" value={draftReference} maxLength={100} onChange={(event) => setDraftReference(event.target.value)} aria-label="Bank reference" />
              </MapRow>
              <MapRow label="Journal">
                <span className="spr-map__pick">
                  <span className="spr-map__pick-text" aria-hidden>{journal?.name ?? ""}</span>
                  <ChevronDown size={14} strokeWidth={2} aria-hidden />
                  <select className="spr-map__input spr-map__pick-select" name="journalId" value={journal?.journalId ?? ""} onChange={(event) => setDraftJournalId(Number(event.target.value))} aria-label="Journal">
                    {journals.map((item) => <option key={item.journalId} value={item.journalId}>{item.name}</option>)}
                  </select>
                </span>
              </MapRow>
              <MapRow label="Payment Method" value="Manual" />
              <MapRow label="Company Bank Account" value={journal?.companyBank ?? "Unknown account"} />
            </div>
            {!edited.ok && open ? <p className="spr-date-note">{edited.error}</p> : null}
            <div className="spr-actions">
              <Link href={back} className="spr-cancel">Cancel</Link>
              {open && mayAct ? (
                <PendingSubmit className="spr-confirm" pendingLabel={postReady ? "Receipting…" : "Confirming…"} disabled={!edited.ok || (automatic && !customerLinked)}>
                  {postReady ? "Confirm Payment & Receipt" : "Confirm in Trinity"}
                  <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
                </PendingSubmit>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

function MapRow({
  label,
  value,
  tone = "plain",
  children,
}: {
  label: string;
  value?: string;
  tone?: "plain" | "good" | "bad" | "pill";
  children?: React.ReactNode;
}) {
  const Icon = ICONS[label] ?? Hash;
  return (
    <div className="spr-map__row" role="row">
      <span className="spr-map__label" role="rowheader">
        <Icon size={14} strokeWidth={1.75} aria-hidden />
        {label}
      </span>
      <ArrowRight size={13} strokeWidth={1.75} aria-hidden className="spr-map__arrow" />
      {children ?? <span className={`spr-map__value is-${tone}`} role="cell">{value}</span>}
    </div>
  );
}
