"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDealer, requireDepot, requireInternal } from "@/lib/session";
import { canOperateDepot } from "@/lib/access";
import { applyInternalOrderAction } from "@/lib/orders/internal-order-actions";
import {
  applyDepotAction,
  lookUpMpesaCode,
  submitDealerOrder,
  submitPayment,
} from "@/lib/orders/service";
import { ignoreStaleTransition, InvalidOrderTransition, StaleOrderTransition } from "@/lib/orders/state-machine";
import {
  isDepotAction,
  freeText,
  OrderInputError,
  parseDeliveryDate,
  parseLitres,
  parseOrderLines,
} from "@/lib/orders/order-input";
import { DEALER_ORDERING_UNAVAILABLE, dealerCommercialOrdersBlockedReason } from "@/lib/security/launch-mode";

/** What the dealer forms get back: a message to show, or null when the action went through. */
export type ActionResult = { error: string } | null;

function submissionKey(value: FormDataEntryValue | null) {
  const key = String(value || "");
  return /^[A-Za-z0-9-]{16,64}$/.test(key) ? key : null;
}


export async function placeOrderAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireDealer();
  const blocked = dealerCommercialOrdersBlockedReason();
  if (blocked) {
    console.warn(`[orders] dealer order refused: ${blocked}`);
    return { error: DEALER_ORDERING_UNAVAILABLE };
  }
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
      dealerReference: freeText(formData.get("dealerReference")) ?? null,
      notes: freeText(formData.get("notes")) ?? null,
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

const PAYMENT_METHODS = ["MANUAL", "MPESA_CODE", "MPESA_PROMPT"] as const;

export async function paymentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireDealer();
  const orderId = String(formData.get("orderId") || "");
  const method = PAYMENT_METHODS.find((m) => m === formData.get("method")) ?? "MANUAL";
  try {
    await submitPayment({
      orderId,
      actorId: session.user.id,
      dealerOrganizationId: session.user.dealerOrganizationId!,
      method,
      amount: String(formData.get("amount") || ""),
      bankReference: freeText(formData.get("bankReference")),
      bankAccountNumber: freeText(formData.get("bankAccountNumber")),
      mpesaCode: freeText(formData.get("mpesaCode")),
      note: freeText(formData.get("note")),
    });
  } catch (error) {
    if (error instanceof OrderInputError) return { error: error.message };
    if (error instanceof InvalidOrderTransition || error instanceof StaleOrderTransition) {
      return { error: "This order can't take a payment right now. Refresh the page." };
    }
    throw error;
  }
  revalidatePath(`/dealer/orders/${orderId}`);
  revalidatePath("/dealer/dashboard");
  return null;
}

/** "Check code" in the Pay PFI popup: finds the dealer's M-PESA payment in Odoo (read only). */
export async function checkMpesaCodeAction(code: string) {
  await requireDealer();
  try {
    return await lookUpMpesaCode(String(code ?? ""));
  } catch {
    return { ok: false as const, error: "We couldn't check this code right now. Try again shortly." };
  }
}

export async function internalOrderAction(formData: FormData) {
  const session = await requireInternal();
  await applyInternalOrderAction(session.user, formData);
  revalidatePath("/intelligence/retail/orders");
  revalidatePath(`/intelligence/retail/orders/${String(formData.get("orderId") || "")}`);
}

export async function depotOrderAction(formData: FormData) {
  const session = await requireDepot();
  if (!canOperateDepot(session.user.role)) throw new Error("Depot action is not permitted.");
  const orderId = String(formData.get("orderId") || "");
  const action = formData.get("action");
  const refresh = () => {
    revalidatePath("/depot/dashboard");
    revalidatePath(`/depot/orders/${orderId}`);
  };
  // A crafted or stale request changes nothing and refreshes the board, rather than an error page.
  if (!isDepotAction(action)) return refresh();
  const loadedPms = parseLitres(formData.get("loadedPmsLitres"));
  const loadedAgo = parseLitres(formData.get("loadedAgoLitres"));
  if (!loadedPms.ok || !loadedAgo.ok) return refresh();
  try {
    await ignoreStaleTransition(() => applyDepotAction(orderId, session.user, action, {
    truckRegistration: freeText(formData.get("truckRegistration")),
    driverName: freeText(formData.get("driverName")),
    transporter: freeText(formData.get("transporter")),
    loadedPmsLitres: loadedPms.value || undefined,
    loadedAgoLitres: loadedAgo.value || undefined,
    loadingReference: freeText(formData.get("loadingReference")),
    sealNumbers: freeText(formData.get("sealNumbers")),
    deliveryNoteRef: freeText(formData.get("deliveryNoteRef")),
    }));
  } catch (error) {
    // Another depot's order, or a second click from a stale tab: nothing to do but show the current board.
    if (error instanceof OrderInputError || error instanceof InvalidOrderTransition) return refresh();
    throw error;
  }
  refresh();
}
