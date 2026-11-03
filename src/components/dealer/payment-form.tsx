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
    <form onSubmit={onSubmit} className="ui-panel ot-pay" aria-labelledby="ot-pay-title">
      <input type="hidden" name="orderId" value={orderId} />
      <h2 id="ot-pay-title" className="ui-section-title">
        Submit payment details
      </h2>
      <label className="ui-field">
        Amount (KES)
        <input
          className="ui-input"
          name="amount"
          required
          inputMode="decimal"
          defaultValue={amountDue ?? ""}
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "pay-error" : undefined}
        />
        {state?.error ? (
          <span id="pay-error" className="ui-field__error" role="alert">
            {state.error}
          </span>
        ) : null}
      </label>
      <label className="ui-field">
        Bank reference
        <input className="ui-input" name="bankReference" maxLength={100} />
      </label>
      <label className="ui-field">
        Transaction reference
        <input className="ui-input" name="transactionReference" maxLength={100} />
      </label>
      <label className="ui-field">
        Payment date
        <input className="ui-input" name="paymentDate" type="date" />
      </label>
      <label className="ui-field">
        Note
        <textarea className="ui-input" name="note" rows={2} maxLength={500} />
      </label>
      <button type="submit" className="ui-btn ui-btn--primary" disabled={pending}>
        {pending ? "Submitting…" : "Submit payment"}
      </button>
    </form>
  );
}
