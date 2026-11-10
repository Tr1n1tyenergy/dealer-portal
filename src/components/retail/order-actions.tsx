import type { DealerOrderStatus } from "@prisma/client";
import { internalOrderAction } from "@/lib/orders/actions";
import { staffOrderActions } from "@/lib/orders/staff-actions";

/** The buttons staff use on one order (Orders and Home). Nothing for people without Act on Orders. */
export function OrderActions({
  orderId,
  status,
  depots,
  mayAct,
}: {
  orderId: string;
  status: DealerOrderStatus;
  depots: { id: string; name: string }[];
  mayAct: boolean;
}) {
  const actions = staffOrderActions(status);
  if (!mayAct || actions.length === 0) return null;
  return (
    <form action={internalOrderAction} className="so-actions">
      <input type="hidden" name="orderId" value={orderId} />
      {actions.includes("retry-sync") ? (
        <button className="ui-btn ui-btn--secondary" name="action" value="retry-sync">
          Retry sync
        </button>
      ) : null}
      {actions.includes("generate-pfi") || actions.includes("finish-pfi") ? (
        <button className="ui-btn ui-btn--secondary" name="action" value="generate-pfi">
          {actions.includes("finish-pfi") ? "Finish PFI" : "Generate PFI"}
        </button>
      ) : null}
      {actions.includes("confirm-payment") ? (
        <>
          <button className="ui-btn ui-btn--primary" name="action" value="confirm-payment">
            Confirm payment
          </button>
          <button className="ui-btn ui-btn--destructive" name="action" value="reject-payment">
            Flag exception
          </button>
        </>
      ) : null}
      {actions.includes("release") ? (
        <>
          <select name="depotId" className="ui-input so-actions__depot" defaultValue={depots[0]?.id} aria-label="Depot">
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id}>
                {depot.name}
              </option>
            ))}
          </select>
          <button className="ui-btn ui-btn--primary" name="action" value="release">
            Release to depot
          </button>
        </>
      ) : null}
    </form>
  );
}
