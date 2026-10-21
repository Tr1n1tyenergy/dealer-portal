"use client";

import { startTransition, useActionState } from "react";
import { paymentAction } from "@/lib/orders/actions";

/** Dealer payment details; shows the server's message (e.g. an invalid amount) next to the field. */
export function PaymentForm({ orderId, amountDue }: { orderId: string; amountDue: string | null }) {
  const [state, formAction, pending] = useActionState(paymentAction, null);

  // Submitting through onSubmit (not <form action>) stops React resetting the form after an error,
  // so the dealer keeps their references and note while they correct the amount.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="dp-ot-card dp-ot-pay">
      <input type="hidden" name="orderId" value={orderId} />
      <h3>Submit payment details</h3>
      <label>
        Amount
        <input
          name="amount"
          required
          inputMode="decimal"
          defaultValue={amountDue ?? ""}
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "pay-error" : undefined}
        />
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
        <textarea name="note" rows={2} maxLength={500} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit payment"}
      </button>
    </form>
  );
}
