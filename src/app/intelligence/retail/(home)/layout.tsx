import { unreadMessageCount } from "@/lib/messaging/service";
import { requireInternal } from "@/lib/session";
import { StaffPortalShell } from "@/components/staff/staff-portal-shell";

export default async function StaffHomeLayout({ children }: { children: React.ReactNode }) {
  const session = await requireInternal();

  let notificationCount = 0;
  try {
    notificationCount = await unreadMessageCount(session.user.id);
  } catch {
    notificationCount = 0;
  }

  return (
    <StaffPortalShell user={session.user} notificationCount={notificationCount}>
      {children}
    </StaffPortalShell>
  );
}
