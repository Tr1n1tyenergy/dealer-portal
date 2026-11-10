import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SupportCentre, type SupportSection } from "@/components/dealer/support-centre";
import { SUPPORT_DEPARTMENTS, type SupportDepartment } from "@/lib/support/constants";
import "../../dealer-support.css";

export default async function DealerSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; department?: string }>;
}) {
  const session = await requireDealer();
  const { section: rawSection, department: rawDept } = await searchParams;
  const section: SupportSection =
    rawSection === "new" || rawSection === "faq" || rawSection === "contact" || rawSection === "tickets"
      ? rawSection
      : "tickets";
  const initialDepartment = SUPPORT_DEPARTMENTS.includes(rawDept as SupportDepartment)
    ? (rawDept as SupportDepartment)
    : undefined;

  const orgId = session.user.dealerOrganizationId!;
  const [org, orders] = await Promise.all([
    prisma.dealerOrganization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, reference: true },
    }),
  ]);

  return (
    <SupportCentre
      initialSection={section}
      initialDepartment={initialDepartment}
      identity={{
        fullName: `${session.user.firstName} ${session.user.lastName}`.trim(),
        email: session.user.email ?? "",
        organizationName: org?.name ?? "Your dealership",
      }}
      orders={orders}
    />
  );
}
