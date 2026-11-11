import { redirect } from "next/navigation";
import { canAccessRetail } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";

export default async function RetailRootLayout({ children }: { children: React.ReactNode }) {
  const session = await requireInternal();
  if (!canAccessRetail(session.user)) redirect("/intelligence/dashboard");
  return children;
}
