/**
 * Launch / preview controls for first Vercel deployment.
 *
 * TRI_LAUNCH_MODE:
 * - unset / "full" — normal operations (dealer orders allowed)
 * - "staff_preview" — block dealer order placement; intended with ODOO_MODE=mock
 *
 * When NODE_ENV=production and ODOO_MODE is mock (default), dealer commercial
 * orders are blocked unless TRI_ALLOW_MOCK_DEALER_ORDERS=1 (emergency override).
 */

import { odooEnv } from "@/lib/integrations/odoo/config";

export type LaunchMode = "full" | "staff_preview";

export function getLaunchMode(): LaunchMode {
  const raw = (process.env.TRI_LAUNCH_MODE ?? "").trim().toLowerCase();
  if (raw === "staff_preview") return "staff_preview";
  return "full";
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isMockOdooMode(): boolean {
  return odooEnv().mode !== "live";
}

/**
 * Returns an error message if dealer commercial order placement must be blocked.
 * Staff/internal sync paths should also avoid presenting mock docs as real.
 */
export function dealerCommercialOrdersBlockedReason(): string | null {
  if (process.env.TRI_ALLOW_MOCK_DEALER_ORDERS === "1") {
    return null;
  }

  const launch = getLaunchMode();
  if (launch === "staff_preview") {
    return "Dealer ordering is disabled in staff-preview launch mode.";
  }

  if (isProductionRuntime() && isMockOdooMode()) {
    return "Dealer ordering is disabled while Odoo runs in mock mode on this production deployment.";
  }

  return null;
}

/** What dealers see when ordering is off; the technical reason stays in the server log. */
export const DEALER_ORDERING_UNAVAILABLE =
  "Online ordering isn't available yet. You can't place orders here at the moment. Please contact your Trinity account manager to order.";

/** The dealer-facing notice when ordering is off, or null when dealers may order. */
export function dealerOrderingNotice(): string | null {
  return dealerCommercialOrdersBlockedReason() ? DEALER_ORDERING_UNAVAILABLE : null;
}

export function assertDealerCommercialOrdersAllowed(): void {
  const reason = dealerCommercialOrdersBlockedReason();
  if (reason) throw new Error(reason);
}

/** Prefix for mock commercial document numbers so they are never mistaken for live Odoo docs. */
export function mockCommercialDocumentPrefix(): string {
  return "MOCK";
}
