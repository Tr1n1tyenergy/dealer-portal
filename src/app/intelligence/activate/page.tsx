import { Suspense } from "react";
import { ActivatePasswordForm } from "@/components/auth/activate-password-form";

export default function StaffActivatePage() {
  return (
    <Suspense fallback={<div className="login-page">Loading…</div>}>
      <ActivatePasswordForm
        portal="staff"
        loginHref="/intelligence/login"
        title="Activate staff account"
        subtitle="Set your password to access Trinity Retail Intelligence."
      />
    </Suspense>
  );
}
