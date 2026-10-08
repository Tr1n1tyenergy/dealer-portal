import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom =
  process.env.EMAIL_FROM ?? "Trinity Retail Intelligence <noreply@trinityenergyltd.com>";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resendApiKey) {
    console.info("[email:dev]", {
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { id: "dev-email", skipped: true as const };
  }

  const resend = new Resend(resendApiKey);
  const result = await resend.emails.send({
    from: emailFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  return result;
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
      <p style="color:#334155;line-height:1.6;margin:0 0 20px">Hi ${params.firstName},</p>
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
      <p style="color:#334155;line-height:1.6;margin:0 0 20px">Hi ${params.firstName},</p>
      <p style="color:#334155;line-height:1.6;margin:0 0 24px">Click below to choose a new password for your TRI account.</p>
      <a href="${params.resetUrl}" style="display:inline-block;background:#F5B800;color:#0A235B;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">Reset Password</a>
      <p style="color:#64748b;font-size:13px;margin:28px 0 0">This link expires in 1 hour.</p>
    </div>
  </div>`;
}
