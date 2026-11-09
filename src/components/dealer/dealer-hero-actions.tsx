"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { PayPfiPanel } from "./pay-pfi-panel";
import { usePayPfi } from "./pay-pfi-context";
import "./dealer-hero-actions.css";

/**
 * Left-aligned hero CTAs matching Dashboard: Place an Order + glowing Pay for this PFI.
 * Pay button only renders when the portal layout found a payable PFI.
 */
export function DealerHeroActions({
  showPlaceOrder = true,
}: {
  showPlaceOrder?: boolean;
}) {
  const payPfi = usePayPfi();
  if (!showPlaceOrder && !payPfi) return null;

  return (
    <div className="dp-hero-actions">
      {showPlaceOrder ? (
        <Link href="/dealer/orders/new" className="dp-hero-actions__place">
          <ShoppingCart size={16} strokeWidth={2.2} aria-hidden />
          Place an Order
        </Link>
      ) : null}
      {payPfi ? <PayPfiPanel {...payPfi} variant="inline" /> : null}
    </div>
  );
}
