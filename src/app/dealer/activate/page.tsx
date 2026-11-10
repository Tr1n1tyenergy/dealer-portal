import { Suspense } from "react";
import { ActivatePasswordForm } from "@/components/auth/activate-password-form";

export default function DealerActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivatePasswordForm
        portal="dealer"
        loginHref="/dealer/login"
        title="Activate dealer account"
        subtitle="Set your password to access the Trinity Dealer Portal."
      />
    </Suspense>
  );
}
