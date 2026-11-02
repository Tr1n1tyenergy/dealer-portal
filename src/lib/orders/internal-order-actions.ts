import { canUser, type StaffUser } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { confirmPayment, generatePfi, releaseToDepot, syncQuotation } from "@/lib/orders/service";
import { ignoreStaleTransition } from "@/lib/orders/state-machine";

/**
 * Staff actions on a dealer order. Plain module, not "use server": the caller must pass the
 * signed-in user (internalOrderAction does), because the actor here is trusted.
 * Only roles with "orders.act" (Admin, Sales Person Executive) may act; others change nothing.
 */
export async function applyInternalOrderAction(
  actor: StaffUser & { id: string; role: string },
  formData: FormData
): Promise<"done" | "refused"> {
  const orderId = String(formData.get("orderId") || "");
  const action = String(formData.get("action") || "");

  if (!canUser(actor, "orders", "act")) {
    await logActivity({
      actorId: actor.id,
      action: "ORDER_ACTION_REFUSED",
      entity: "DealerOrder",
      entityId: orderId,
      meta: { action, role: actor.role },
    });
    return "refused";
  }

  if (action === "retry-sync") await ignoreStaleTransition(() => syncQuotation(orderId, actor.id));
  if (action === "generate-pfi") await ignoreStaleTransition(() => generatePfi(orderId, actor.id));
  if (action === "confirm-payment" || action === "reject-payment") {
    await ignoreStaleTransition(() => confirmPayment(orderId, actor.id, action === "confirm-payment"));
  }
  if (action === "release") {
    const depot = await prisma.depot.findFirst({ orderBy: { name: "asc" } });
    if (!depot) throw new Error("No depot is configured.");
    const depotId = String(formData.get("depotId") || depot.id);
    await ignoreStaleTransition(() => releaseToDepot(orderId, actor.id, depotId));
  }
  return "done";
}
