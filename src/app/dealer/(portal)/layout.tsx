import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { unreadMessageCount } from "@/lib/messaging/service";
import "../dealer-portal.css";

export default async function DealerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDealer();
  const [org, unread] = await Promise.all([
    prisma.dealerOrganization.findUnique({
      where: { id: session.user.dealerOrganizationId! },
      include: {
        stations: {
          select: { tradingName: true, name: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    // The bell is a nicety: a messaging error must not take every dealer page down.
    unreadMessageCount(session.user.id).catch(() => 0),
  ]);
  // Post-activation: trading name is the primary dealer label
  const orgName =
    org?.stations[0]?.tradingName ||
    org?.stations[0]?.name ||
    org?.name ||
    "Dealer Account";
  const initials = (org?.code ?? orgName)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase() || "AB";

  return (
    <DealerShell
      orgName={orgName}
      initials={initials}
      name={
        `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() ||
        orgName
      }
      email={session.user.email ?? ""}
      unread={unread}
    >
      {children}
    </DealerShell>
  );
}
