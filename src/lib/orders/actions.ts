"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDealer, requireDepot, requireInternal } from "@/lib/session";
import { canOperateDepot, canReleaseToDepot, canVerifyPayment, canManageCommercialOrders } from "@/lib/access";
import {
  applyDepotAction,
  confirmPayment,
  generatePfi,
  releaseToDepot,
  submitDealerOrder,
  submitPayment,
  syncQuotation,
} from "@/lib/orders/service";
import { prisma } from "@/lib/prisma";

function litres(value: FormDataEntryValue | null) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function placeOrderAction(formData: FormData) {
  const session = await requireDealer();
  const lines = [
    { product: "PMS" as const, quantityLitres: litres(formData.get("pms")) },
    { product: "AGO" as const, quantityLitres: litres(formData.get("ago")) },
  ].filter((line) => line.quantityLitres > 0);

  const order = await submitDealerOrder({
    actorId: session.user.id,
    dealerOrganizationId: session.user.dealerOrganizationId!,
    stationId: String(formData.get("stationId") || ""),
    requestedDeliveryDate: String(formData.get("requestedDeliveryDate") || "") || null,
    dealerReference: String(formData.get("dealerReference") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    lines,
  });
  revalidatePath("/dealer/dashboard");
  revalidatePath("/dealer/orders");
  revalidatePath(`/dealer/orders/${order.id}`);
  redirect(`/dealer/orders/${order.id}`);
}

export async function paymentAction(formData: FormData) {
  const session = await requireDealer();
  const orderId = String(formData.get("orderId") || "");
  await submitPayment({
    orderId,
    actorId: session.user.id,
    dealerOrganizationId: session.user.dealerOrganizationId!,
    amount: String(formData.get("amount") || "0"),
    bankReference: String(formData.get("bankReference") || "") || undefined,
    transactionReference: String(formData.get("transactionReference") || "") || undefined,
    paymentDate: String(formData.get("paymentDate") || "") || undefined,
    note: String(formData.get("note") || "") || undefined,
  });
  revalidatePath(`/dealer/orders/${orderId}`);
}

export async function internalOrderAction(formData: FormData) {
  const session = await requireInternal();
  const role = session.user.role;
  if (!canManageCommercialOrders(role)) throw new Error("You cannot manage dealer orders.");
  const orderId = String(formData.get("orderId") || "");
  const action = String(formData.get("action") || "");

  if (action === "retry-sync") await syncQuotation(orderId, session.user.id);
  if (action === "generate-pfi") await generatePfi(orderId, session.user.id);
  if (action === "confirm-payment" || action === "reject-payment") {
    if (!canVerifyPayment(role)) throw new Error("Payment verification is restricted.");
    await confirmPayment(orderId, session.user.id, action === "confirm-payment");
  }
  if (action === "release") {
    if (!canReleaseToDepot(role)) throw new Error("Only authorised staff can release to depot.");
    const depot = await prisma.depot.findFirst({ orderBy: { name: "asc" } });
    if (!depot) throw new Error("No depot is configured.");
    await releaseToDepot(orderId, session.user.id, String(formData.get("depotId") || depot.id));
  }
  revalidatePath("/intelligence/reports/dealer-operations");
  revalidatePath(`/intelligence/reports/dealer-operations/${orderId}`);
}

export async function depotOrderAction(formData: FormData) {
  const session = await requireDepot();
  if (!canOperateDepot(session.user.role)) throw new Error("Depot action is not permitted.");
  const orderId = String(formData.get("orderId") || "");
  const action = String(formData.get("action") || "") as "accept" | "complete" | "dispatch" | "deliver" | "close";
  await applyDepotAction(orderId, session.user.id, action, {
    truckRegistration: String(formData.get("truckRegistration") || "") || undefined,
    driverName: String(formData.get("driverName") || "") || undefined,
    transporter: String(formData.get("transporter") || "") || undefined,
    loadedPmsLitres: litres(formData.get("loadedPmsLitres")) || undefined,
    loadedAgoLitres: litres(formData.get("loadedAgoLitres")) || undefined,
    loadingReference: String(formData.get("loadingReference") || "") || undefined,
    sealNumbers: String(formData.get("sealNumbers") || "") || undefined,
    deliveryNoteRef: String(formData.get("deliveryNoteRef") || "") || undefined,
  });
  revalidatePath("/depot/dashboard");
  revalidatePath(`/depot/orders/${orderId}`);
}
