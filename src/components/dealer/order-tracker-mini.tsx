import type { DealerOrderStatus } from "@prisma/client";
import { dealerTrackerSteps } from "@/lib/orders/state-machine";
import "./order-tracker-mini.css";

/** The seven order steps in one row (a list on phones); the current step pulses. */
export function OrderTrackerMini({ status }: { status: DealerOrderStatus }) {
  const { steps } = dealerTrackerSteps(status);
  return (
    <ol className="otm" aria-label="Order progress">
      {steps.map((s, i) => {
        const current = s.state === "active" || s.state === "attention";
        return (
          <li key={s.key} className={`otm-step is-${s.state}`} aria-current={current ? "step" : undefined}>
            <span className="otm-dot" aria-hidden>
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <span className="otm-label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
