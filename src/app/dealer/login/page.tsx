import { PortalLogin } from "@/components/access/portal-login";

export default function DealerLoginPage() {
  return (
    <PortalLogin
      portal="dealer"
      title="Sign in to the dealer portal"
      description="Place fuel orders, open your PFIs, send payment details and follow your deliveries."
      button="Sign in"
      destination="/dealer/dashboard"
      headline="Fuel for your stations, on time."
      copy="Order PMS and AGO, pay your PFI and follow every truck from the depot to your forecourt."
    />
  );
}
