"use client";

import { BrandPanel, PortalLogin } from "@/components/access/portal-login";

export default function DepotLoginPage() {
  return (
    <PortalLogin
      portal="depot"
      badge="Depot Operations"
      badgeTone="green"
      title="Sign In to Depot Operations"
      description="Access the depot operations portal to manage releases, loading, dispatch and deliveries."
      button="Sign In to Depot Operations"
      destination="/depot/dashboard"
      support="Contact Trinity Support for account setup or any depot portal assistance."
      brand={
        <BrandPanel
          kicker="Depot & Operations"
          headline="Reliable operations for a"
          highlight="stronger tomorrow."
          lede="Safe, efficient and transparent fuel release and logistics operations across East Africa."
          ariaLabel="Depot Operations"
        />
      }
    />
  );
}
