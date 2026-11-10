"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { PayPfiPanel } from "./pay-pfi-panel";
import { usePayPfi } from "./pay-pfi-context";
import "./dealer-hero-actions.css";

/**
 * Left-aligned hero CTAs: Place an order (primary) and, only where paying is the task
 * (orders pages), a secondary Pay for this PFI when the portal layout found a payable PFI.
 */
export function DealerHeroActions({
  showPlaceOrder = true,
  showPay = false,
}: {
  showPlaceOrder?: boolean;
  showPay?: boolean;
}) {
  const ctx = usePayPfi();
  const payPfi = showPay ? ctx : null;
  if (!showPlaceOrder && !payPfi) return null;

  return (
    <div className="dp-hero-actions">
      {showPlaceOrder ? (
        <Link href="/dealer/orders/new" className="dp-hero-actions__place">
          <ShoppingCart size={16} strokeWidth={2.2} aria-hidden />
          Place an order
        </Link>
      ) : null}
      {payPfi ? <PayPfiPanel {...payPfi} variant="inline" /> : null}
    </div>
  );
}
