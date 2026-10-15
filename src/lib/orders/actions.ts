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
import { ignoreStaleTransition, InvalidOrderTransition, StaleOrderTransition } from "@/lib/orders/state-machine";
import { isDepotAction, OrderInputError, parseDeliveryDate, parseOrderLines, parsePaymentAmount } from "@/lib/orders/order-input";
import { dealerCommercialOrdersBlockedReason } from "@/lib/security/launch-mode";

/** What the dealer forms get back: a message to show, or null when the action went through. */
export type ActionResult = { error: string } | null;

function submissionKey(value: FormDataEntryValue | null) {
  const key = String(value || "");
  return /^[A-Za-z0-9-]{16,64}$/.test(key) ? key : null;
}

function litres(value: FormDataEntryValue | null) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function placeOrderAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireDealer();
  const blocked = dealerCommercialOrdersBlockedReason();
  if (blocked) return { error: blocked };
  const lines = parseOrderLines({ pms: formData.get("pms"), ago: formData.get("ago") });
  if (!lines.ok) return { error: lines.message };
  const deliveryDate = parseDeliveryDate(formData.get("requestedDeliveryDate"));
  if (!deliveryDate.ok) return { error: deliveryDate.message };

  let order: { id: string };
  try {
    order = await submitDealerOrder({
      actorId: session.user.id,
      dealerOrganizationId: session.user.dealerOrganizationId!,
      stationId: String(formData.get("stationId") || ""),
      requestedDeliveryDate: deliveryDate.value,
      dealerReference: String(formData.get("dealerReference") || "") || null,
      notes: String(formData.get("notes") || "") || null,
      lines: lines.value,
      submissionKey: submissionKey(formData.get("submissionKey")),
    });
  } catch (error) {
    if (error instanceof OrderInputError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dealer/dashboard");
  revalidatePath("/dealer/orders");
  revalidatePath(`/dealer/orders/${order.id}`);
  redirect(`/dealer/orders/${order.id}`);
}

export async function paymentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireDealer();
  const orderId = String(formData.get("orderId") || "");
  const amount = parsePaymentAmount(formData.get("amount"));
  if (!amount.ok) return { error: amount.message };
  try {
    await submitPayment({
      orderId,
      actorId: session.user.id,
      dealerOrganizationId: session.user.dealerOrganizationId!,
      amount: amount.value,
      bankReference: String(formData.get("bankReference") || "") || undefined,
      transactionReference: String(formData.get("transactionReference") || "") || undefined,
      paymentDate: String(formData.get("paymentDate") || "") || undefined,
      note: String(formData.get("note") || "") || undefined,
    });
  } catch (error) {
    if (error instanceof OrderInputError) return { error: error.message };
    if (error instanceof InvalidOrderTransition || error instanceof StaleOrderTransition) {
      return { error: "This order can't take a payment right now. Refresh the page." };
    }
    throw error;
  }
  revalidatePath(`/dealer/orders/${orderId}`);
  return null;
}

export async function internalOrderAction(formData: FormData) {
  const session = await requireInternal();
  const role = session.user.role;
  if (!canManageCommercialOrders(role)) throw new Error("You cannot manage dealer orders.");
  const orderId = String(formData.get("orderId") || "");
  const action = String(formData.get("action") || "");

  if (action === "retry-sync") await ignoreStaleTransition(() => syncQuotation(orderId, session.user.id));
  if (action === "generate-pfi") await ignoreStaleTransition(() => generatePfi(orderId, session.user.id));
  if (action === "confirm-payment" || action === "reject-payment") {
    if (!canVerifyPayment(role)) throw new Error("Payment verification is restricted.");
    await ignoreStaleTransition(() => confirmPayment(orderId, session.user.id, action === "confirm-payment"));
  }
  if (action === "release") {
    if (!canReleaseToDepot(role)) throw new Error("Only authorised staff can release to depot.");
    const depot = await prisma.depot.findFirst({ orderBy: { name: "asc" } });
    if (!depot) throw new Error("No depot is configured.");
    const depotId = String(formData.get("depotId") || depot.id);
    await ignoreStaleTransition(() => releaseToDepot(orderId, session.user.id, depotId));
  }
  revalidatePath("/intelligence/reports/dealer-operations");
  revalidatePath(`/intelligence/reports/dealer-operations/${orderId}`);
}

export async function depotOrderAction(formData: FormData) {
  const session = await requireDepot();
  if (!canOperateDepot(session.user.role)) throw new Error("Depot action is not permitted.");
  const orderId = String(formData.get("orderId") || "");
  const action = formData.get("action");
  // A crafted or stale request changes nothing rather than failing with a server error.
  if (!isDepotAction(action)) return;
  try {
    await ignoreStaleTransition(() => applyDepotAction(orderId, session.user, action, {
    truckRegistration: String(formData.get("truckRegistration") || "") || undefined,
    driverName: String(formData.get("driverName") || "") || undefined,
    transporter: String(formData.get("transporter") || "") || undefined,
    loadedPmsLitres: litres(formData.get("loadedPmsLitres")) || undefined,
    loadedAgoLitres: litres(formData.get("loadedAgoLitres")) || undefined,
    loadingReference: String(formData.get("loadingReference") || "") || undefined,
    sealNumbers: String(formData.get("sealNumbers") || "") || undefined,
    deliveryNoteRef: String(formData.get("deliveryNoteRef") || "") || undefined,
    }));
  } catch (error) {
    if (error instanceof OrderInputError) return;
    throw error;
  }
  revalidatePath("/depot/dashboard");
  revalidatePath(`/depot/orders/${orderId}`);
}
