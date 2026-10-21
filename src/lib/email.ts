import { Resend } from "resend";

const emailFrom =
  process.env.EMAIL_FROM ?? "Trinity Retail Intelligence <noreply@trinityenergyltd.com>";

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function hasResendCredentials() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** True when outbound email can be attempted. */
export function emailDeliveryConfigured(): boolean {
  return hasResendCredentials();
}

/**
 * Send an email via Resend.
 * - Never logs HTML or token-bearing URLs.
 * - In production, fails closed when RESEND_API_KEY is missing.
 * - In non-production without Resend, records a redacted console notice and returns skipped
 *   only when explicitly allowed for local/staging tooling (TRI_ALLOW_DEV_EMAIL_SKIP=1).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string; skipped?: true }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (isProductionRuntime()) {
      throw new EmailDeliveryError(
        "Email delivery is not configured. Set RESEND_API_KEY before sending invitations or password resets."
      );
    }
    if (process.env.TRI_ALLOW_DEV_EMAIL_SKIP === "1") {
      console.info("[email:dev] skipped send (no RESEND_API_KEY)", {
        to: params.to,
        subject: params.subject,
        // Intentionally omit html / URLs
      });
      return { id: "dev-email-skipped", skipped: true };
    }
    throw new EmailDeliveryError(
      "Email delivery is not configured. Set RESEND_API_KEY, or TRI_ALLOW_DEV_EMAIL_SKIP=1 for local-only skips."
    );
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: emailFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (result.error) {
    throw new EmailDeliveryError(result.error.message || "Email provider rejected the message.");
  }

  const id = result.data?.id;
  if (!id) {
    throw new EmailDeliveryError("Email provider did not confirm delivery.");
  }

  return { id };
}

/** Names are typed by people: show them as text, never as markup. */
const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function invitationEmailHtml(params: {
  firstName: string;
  activateUrl: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif;background:#F5F7FA;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;border:1px solid rgba(0,0,0,0.06)">
      <div style="font-size:13px;letter-spacing:0.08em;color:#F5B800;font-weight:700;text-transform:uppercase">Trinity Retail Intelligence</div>
      <h1 style="color:#0A235B;font-size:24px;margin:16px 0 8px">Welcome to Trinity Retail Intelligence</h1>
      <p style="color:#334155;line-height:1.6;margin:0 0 20px">Hi ${escapeHtml(params.firstName)},</p>
      <p style="color:#334155;line-height:1.6;margin:0 0 24px">Your account has been created. Click below to activate your account and set your password.</p>
      <a href="${params.activateUrl}" style="display:inline-block;background:#F5B800;color:#0A235B;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">Set Password</a>
      <p style="color:#64748b;font-size:13px;margin:28px 0 0">If you did not expect this invitation, you can ignore this email.</p>
    </div>
  </div>`;
}

export function passwordResetEmailHtml(params: {
  firstName: string;
  resetUrl: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif;background:#F5F7FA;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;border:1px solid rgba(0,0,0,0.06)">
      <div style="font-size:13px;letter-spacing:0.08em;color:#F5B800;font-weight:700;text-transform:uppercase">Trinity Retail Intelligence</div>
      <h1 style="color:#0A235B;font-size:24px;margin:16px 0 8px">Reset your password</h1>
      <p style="color:#334155;line-height:1.6;margin:0 0 20px">Hi ${escapeHtml(params.firstName)},</p>
      <p style="color:#334155;line-height:1.6;margin:0 0 24px">Click below to choose a new password for your TRI account.</p>
      <a href="${params.resetUrl}" style="display:inline-block;background:#F5B800;color:#0A235B;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">Reset Password</a>
      <p style="color:#64748b;font-size:13px;margin:28px 0 0">This link expires in 1 hour.</p>
    </div>
  </div>`;
}
