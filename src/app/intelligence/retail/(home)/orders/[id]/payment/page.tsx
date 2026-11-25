import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { PaymentReviewEditor } from "@/components/staff/payment-review-editor";
import { resolveOdooPartnerId } from "@/lib/dealers/registry";
import { getOdooClient } from "@/lib/integrations/odoo/client";
import { ODOO_KES_CURRENCY_ID, odooPaymentsEnabled } from "@/lib/integrations/odoo/config";
import { nairobiToday } from "@/lib/orders/order-input";
import { formatKes } from "@/lib/orders/money";
import { buildReceiptPreview, receiptJournals } from "@/lib/orders/receipt-preview";
import { bankAccountByNumber, paymentTotals, toCents } from "@/lib/orders/payments";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/session";
import "@/app/intelligence/retail/staff-orders.css";

export const maxDuration = 60;

const when = (at: Date | null | undefined) =>
  at
    ? at.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Nairobi",
      })
    : "Not recorded";

export default async function PaymentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string; error?: string }>;
}) {
  const session = await requireInternal();
  if (!canUser(session.user, "orders", "view")) redirect("/intelligence/retail");
  const mayAct = canUser(session.user, "orders", "act");
  const { id } = await params;
  const query = await searchParams;

  const order = await prisma.dealerOrder.findUnique({
    where: { id },
    include: {
      dealerOrganization: { select: { name: true, odooPartnerId: true, odooPartnerExternalId: true } },
      station: { select: { name: true, tradingName: true, odooPartnerId: true, odooPartnerExternalId: true } },
      proforma: { select: { number: true, amount: true } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const waiting = order.payments.filter((payment) => payment.status === "SUBMITTED" || payment.status === "VERIFICATION");
  const selected =
    order.payments.find((payment) => payment.id === query.payment) ??
    waiting[0] ??
    order.payments[order.payments.length - 1] ??
    null;
  if (!selected) notFound();

  const submitter = selected.submittedById
    ? await prisma.user.findUnique({
        where: { id: selected.submittedById },
        select: { firstName: true, lastName: true, email: true },
      })
    : null;
  const submitterName = submitter
    ? [submitter.firstName, submitter.lastName].filter(Boolean).join(" ") || submitter.email
    : null;

  const manual = selected.method !== "MPESA_CODE";
  const account = bankAccountByNumber(selected.bankAccountNumber);
  const partnerId = resolveOdooPartnerId(order.station.odooPartnerId, order.dealerOrganization.odooPartnerId);
  const partnerExternalId = order.station.odooPartnerExternalId ?? order.dealerOrganization.odooPartnerExternalId ?? null;
  const automatic = odooPaymentsEnabled();
  const transactionDate = selected.paymentDate
    ? selected.paymentDate.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
    : null;
  const preview = buildReceiptPreview({
    method: manual ? "MANUAL" : "MPESA",
    amount: selected.amount,
    bankReference: manual ? selected.bankReference : selected.mpesaCode,
    accountNumber: selected.bankAccountNumber,
    dealerName: order.dealerOrganization.name,
    partnerId,
    partnerExternalId,
    accountingDate: nairobiToday(),
    transactionDate,
    automaticReceipting: automatic,
  });
  const journals = receiptJournals();
  const issues = preview.blockers.filter(
    (item) => !item.startsWith("Automatic receipting is off") && !/bank reference|configured bank/i.test(item)
  );
  const open = selected.status === "SUBMITTED" || selected.status === "VERIFICATION";
  const totals = paymentTotals(order.proforma?.amount ?? order.amountDue, order.payments);
  const thisCents = toCents(selected.amount) ?? 0;
  const back = `/intelligence/retail/orders/${order.id}`;
  const station = order.station.tradingName || order.station.name;
  const mappingNote = automatic
    ? "These values will be posted in Odoo. You can change the amount, currency, bank reference and journal before confirming."
    : "These values are a preview. Automatic posting is currently unavailable.";
  let currencies = [{ id: ODOO_KES_CURRENCY_ID, code: "KES" }];
  try {
    const loaded = await getOdooClient().listCurrencies();
    if (loaded.length) currencies = loaded;
  } catch {
    currencies = [{ id: ODOO_KES_CURRENCY_ID, code: "KES" }];
  }

  return (
    <div className="so">
      <header className="so-hero" aria-label="Payment review hero">
        <div className="so-hero__text">
          <div className="so-hero__crumbs">
            <Link href="/intelligence/retail/orders">Orders</Link>
            {" › "}
            <Link href={back}>{order.reference}</Link>
            {" › Payment"}
          </div>
          <h1>Payment Review &amp; Accounting Receipt</h1>
          <p className="spr-lede">Review the payment details and see how they will be recorded in the Accounts module (Odoo).</p>
          <div className="so-hero__meta">
            <span>
              <Building2 size={14} /> {order.dealerOrganization.name}
            </span>
            <span>
              <MapPin size={14} /> {station}
            </span>
          </div>
        </div>
      </header>

      <div className="so-wrap">
        <div className="spr">
          <Link href={back} className="spr-back">
            <ArrowLeft size={15} strokeWidth={2.2} aria-hidden />
            Back to order {order.reference}
          </Link>

          {waiting.length > 1 ? (
            <div className="spr-switch" aria-label="Payments waiting on this order">
              {waiting.map((payment) => (
                <Link
                  key={payment.id}
                  href={`/intelligence/retail/orders/${order.id}/payment?payment=${payment.id}`}
                  className={payment.id === selected.id ? "is-on" : undefined}
                >
                  {formatKes(payment.amount)}
                </Link>
              ))}
            </div>
          ) : null}

          {query.error ? <p className="spr-warn">Enter a valid amount, bank reference, currency and journal before confirming.</p> : null}
          <PaymentReviewEditor
            orderId={order.id}
            paymentId={selected.id}
            back={back}
            open={open}
            mayAct={mayAct}
            automatic={automatic}
            customerLinked={partnerId != null || Boolean(partnerExternalId)}
            dealerName={order.dealerOrganization.name}
            sentOn={when(selected.createdAt)}
            submitterName={submitterName}
            dealerNote={selected.note}
            methodLabel={manual ? "Manual" : "M-PESA"}
            accountingDate={preview.rows.find((row) => row.label === "Date")?.value ?? nairobiToday()}
            amount={selected.amount}
            bankReference={manual ? selected.bankReference ?? "" : selected.mpesaCode ?? ""}
            journalId={account?.odoo.journalId ?? journals[0]?.journalId ?? 0}
            currencyId={ODOO_KES_CURRENCY_ID}
            journals={journals}
            currencies={currencies}
            totalCents={totals.totalCents}
            confirmedCents={totals.confirmedCents}
            otherWaitingCents={Math.max(0, totals.waitingCents - (open ? thisCents : 0))}
            odooError={selected.odooError}
            issues={issues}
            dateNote={preview.dateNote}
            mappingNote={mappingNote}
          />
        </div>
      </div>
    </div>
  );
}
