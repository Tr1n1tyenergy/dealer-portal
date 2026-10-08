"use client";

import { Fuel, Handshake, Shield, Truck } from "lucide-react";
import { BrandPanel, PortalLogin } from "@/components/access/portal-login";

export default function DealerLoginPage() {
  return (
    <PortalLogin
      portal="dealer"
      badge="DEALER PORTAL"
      title="Welcome Back"
      description="Sign in to your dealer account to place orders, view quotations, manage payments and track deliveries."
      button="Sign In to Dealer Portal"
      destination="/dealer/dashboard"
      support="For account setup or assistance, reach out to your Trinity representative."
      trust={[
        { title: "Secure Access", subtitle: "Provisioned accounts", icon: Shield },
        { title: "Partner Support", subtitle: "Dedicated assistance", icon: Handshake },
        { title: "Transaction History", subtitle: "Orders and documents", icon: Fuel },
      ]}
      brand={
        <BrandPanel
          image="/assets2/img/hero/hero-5-1.jpg"
          headline="Powering a stronger partnership for"
          highlight="your growth."
          copy="A seamless fuel ordering and supply experience built for our valued partners."
          features={[
            { title: "Easy Ordering", description: "Place fuel orders for your stations.", icon: Fuel },
            { title: "Transparent Process", description: "Get quotations, PFIs and status updates.", icon: Handshake },
            { title: "Reliable Supply", description: "Track deliveries and grow with Trinity.", icon: Truck },
          ]}
          statusTitle="Partner Portal"
          statusSub="East Africa Network"
        />
      }
    />
  );
}
