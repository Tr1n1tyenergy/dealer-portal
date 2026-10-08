"use client";

import { FileText, Shield, Truck } from "lucide-react";
import { BrandPanel, PortalLogin } from "@/components/access/portal-login";

export default function DepotLoginPage() {
  return (
    <PortalLogin
      portal="depot"
      badge="DEPOT OPERATIONS"
      badgeTone="green"
      title="Welcome Back"
      description="Sign in to access the depot operations portal. Manage releases, loading, dispatch and deliveries."
      button="Sign In to Depot Operations"
      destination="/depot/dashboard"
      support="For account setup or assistance, reach out to your system administrator."
      trust={[
        { title: "Secure Access", subtitle: "Provisioned accounts", icon: Shield },
        { title: "Role Based Access", subtitle: "Depot permissions", icon: Truck },
        { title: "Audit Logging", subtitle: "Activity recorded", icon: FileText },
      ]}
      brand={
        <BrandPanel
          image="/assets2/img/hero/storage.jpg"
          headline="Reliable operations for a"
          highlight="stronger tomorrow."
          copy="Safe, efficient and transparent fuel release and logistics operations across East Africa."
          features={[
            { title: "Manage Releases", description: "Review and approve orders for loading.", icon: FileText },
            { title: "Operational Visibility", description: "Track loading, dispatch and deliveries.", icon: Truck },
            { title: "Safe & Compliant", description: "Support operational control and compliance.", icon: Shield },
          ]}
          statusTitle="Operations Portal"
          statusSub="East Africa Hub"
        />
      }
    />
  );
}
