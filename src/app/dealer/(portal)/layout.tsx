import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DealerShell } from "@/components/dealer/dealer-shell";
import "../dealer-portal.css";

export default async function DealerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDealer();
  const org = await prisma.dealerOrganization.findUnique({
    where: { id: session.user.dealerOrganizationId! },
  });
  const orgName = org?.name ?? "Dealer Account";
  const initials = (org?.code ?? orgName)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase() || "AB";

  return (
    <DealerShell orgName={orgName} initials={initials}>
      {children}
    </DealerShell>
  );
}
