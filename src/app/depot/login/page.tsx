import { PortalLogin } from "@/components/access/portal-login";

export default function DepotLoginPage() {
  return (
    <PortalLogin
      portal="depot"
      title="Sign in to the depot portal"
      description="See the orders released to your depot and record loading, dispatch and delivery."
      button="Sign in"
      destination="/depot/dashboard"
      headline="From the depot to the forecourt."
      copy="Load, dispatch and deliver the orders Trinity releases to your depot."
    />
  );
}
