"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { paymentAction } from "@/lib/orders/actions";

function SubmitPaymentButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit payment"}
    </button>
  );
}

/** Dealer payment details; shows the server's message (e.g. an invalid amount) next to the field. */
export function PaymentForm({ orderId, amountDue }: { orderId: string; amountDue: string | null }) {
  const [state, formAction] = useActionState(paymentAction, null);
  return (
    <form action={formAction} className="dp-ot-card dp-ot-pay">
      <input type="hidden" name="orderId" value={orderId} />
      <h3>Submit payment details</h3>
      <label>
        Amount
        <input name="amount" required inputMode="decimal" defaultValue={amountDue ?? ""} aria-describedby="pay-error" />
      </label>
      {state?.error ? (
        <p id="pay-error" className="dp-ot-pay__error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label>
        Bank reference
        <input name="bankReference" maxLength={100} />
      </label>
      <label>
        Transaction reference
        <input name="transactionReference" maxLength={100} />
      </label>
      <label>
        Payment date
        <input name="paymentDate" type="date" />
      </label>
      <label>
        Note
        <textarea name="note" rows={2} maxLength={2000} />
      </label>
      <SubmitPaymentButton />
    </form>
  );
}
