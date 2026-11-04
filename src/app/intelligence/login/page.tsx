import { PortalLogin } from "@/components/access/portal-login";

export default function StaffLoginPage() {
  return (
    <PortalLogin
      portal="staff"
      title="Sign in for Trinity staff"
      description="Dealer orders, payments, messages, analytics, meeting notes and presentations."
      button="Sign in"
      destination="/intelligence/dashboard"
      headline="Trinity Retail Intelligence."
      copy="Every dealer order, payment and delivery in one place."
    />
  );
}
