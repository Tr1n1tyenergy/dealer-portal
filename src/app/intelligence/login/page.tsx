"use client";

import { BrandPanel, PortalLogin } from "@/components/access/portal-login";

export default function StaffLoginPage() {
  return (
    <PortalLogin
      portal="staff"
      badge="Secure Access"
      title="Sign In to Trinity Staff"
      description="Access the Trinity Retail Intelligence platform for retail operations, AI Note Taker and presentations."
      button="Sign In to Trinity Staff"
      destination="/intelligence/dashboard"
      support="Contact Trinity Support for account setup or any staff portal assistance."
      brand={
        <BrandPanel
          kicker="Trinity Staff"
          headline="Executive retail intelligence"
          highlight="for Trinity Energy."
          lede="Actionable insights. Smarter decisions. Stronger operations across East Africa."
          ariaLabel="Trinity Staff"
        />
      }
    />
  );
}
