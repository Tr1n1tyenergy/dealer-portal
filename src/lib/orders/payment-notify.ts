import type { PaymentMethod } from "@prisma/client";
import { emailDeliveryConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { canUser } from "@/lib/permissions";
import { formatKes } from "@/lib/orders/money";
import { bankAccountByNumber } from "@/lib/orders/payments";

type EmailFacts = {
  orderReference: string;
  dealerName: string;
  amount: string;
  method: PaymentMethod;
  bankAccountNumber: string | null;
  bankReference: string | null;
  mpesaCode: string | null;
  sentAt: Date;
  reviewUrl: string;
};

const nairobiTime = (at: Date) =>
  at.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });

/** The email a Sales Person Executive gets when a dealer sends a payment. */
export function paymentEmail(p: EmailFacts): { subject: string; html: string } {
  const amount = formatKes(p.amount);
  const mpesa = p.method !== "MANUAL";
  const account = bankAccountByNumber(p.bankAccountNumber);
  const rows: [string, string][] = [
    ["Amount", amount],
    ["Method", mpesa ? "M-PESA" : "Manual (bank)"],
    ...(mpesa
      ? ([["M-PESA code", p.mpesaCode ?? "Not recorded"]] as [string, string][])
      : ([
          ["Paid to", account ? `${account.bank} · ${account.accountNumber}` : p.bankAccountNumber ?? "Not recorded"],
          ["Reference", p.bankReference ?? "Not recorded"],
        ] as [string, string][])),
    ["Sent", nairobiTime(p.sentAt)],
  ];
  const cell = "padding:6px 16px 6px 0;color:#334155";
  return {
    subject: `Payment to confirm: ${amount} from ${p.dealerName} (${p.orderReference})`,
    html: `
  <div style="font-family:Arial,sans-serif;background:#F5F7FA;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;border:1px solid rgba(0,0,0,0.06)">
      <div style="font-size:13px;letter-spacing:0.08em;color:#ffcc00;font-weight:700;text-transform:uppercase">Trinity Retail Intelligence</div>
      <h1 style="color:#0A235B;font-size:22px;margin:16px 0 8px">A dealer has sent a payment</h1>
      <p style="color:#334155;line-height:1.6;margin:0 0 16px">${escapeHtml(p.dealerName)} sent a payment for order ${escapeHtml(p.orderReference)}. Please check it against the bank or M-PESA statement and confirm it in the portal.</p>
      <table style="border-collapse:collapse;font-size:15px;margin:0 0 20px">
        ${rows.map(([k, v]) => `<tr><td style="${cell};color:#64748b">${k}</td><td style="${cell};font-weight:700">${escapeHtml(v)}</td></tr>`).join("")}
      </table>
      <a href="${escapeHtml(p.reviewUrl)}" style="display:inline-block;background:#ffcc00;color:#0A235B;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">Review payment</a>
    </div>
  </div>`,
  };
}

type Deps = {
  send?: (message: { to: string; subject: string; html: string }) => Promise<unknown>;
  configured?: () => boolean;
};

/**
 * Emails every active Sales Person Executive about a payment a dealer just sent.
 * Best effort: runs after the dealer's request (next/server `after`) and never throws,
 * so a slow or failing mail service can't delay or undo a payment.
 */
export async function notifySalesOfPayment(paymentId: string, deps: Deps = {}): Promise<void> {
  const send = deps.send ?? sendEmail;
  const configured = deps.configured ?? emailDeliveryConfigured;
  try {
    if (!configured()) return;
    const { prisma } = await import("@/lib/prisma");
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: paymentId },
      include: { order: { select: { id: true, reference: true, dealerOrganization: { select: { name: true } } } } },
    });
    if (!payment) return;
    // Active SPEs who may still act on orders (a per-person "deny" on Orders or Retail drops them).
    const recipients = (
      await prisma.user.findMany({
        where: { role: "SALES_PERSON_EXECUTIVE", status: "ACTIVE", accountType: "INTERNAL" },
        select: { email: true, role: true, accountType: true, permissions: true },
      })
    ).filter((u) => canUser(u, "orders", "act"));
    const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const message = paymentEmail({
      orderReference: payment.order.reference,
      dealerName: payment.order.dealerOrganization.name,
      amount: payment.amount,
      method: payment.method,
      bankAccountNumber: payment.bankAccountNumber,
      bankReference: payment.bankReference,
      mpesaCode: payment.mpesaCode,
      sentAt: payment.createdAt,
      reviewUrl: `${base}/intelligence/retail/orders/${payment.order.id}/payment`,
    });
    // One at a time: Resend limits requests per second, and each person gets their own email.
    let failed = 0;
    for (const r of recipients) {
      try {
        await send({ to: r.email, ...message });
      } catch {
        failed++;
      }
    }
    if (failed) console.error(`[payments] ${failed} of ${recipients.length} payment emails failed for payment ${paymentId}`);
  } catch (error) {
    console.error("[payments] could not email Sales Person Executives", error);
  }
}
