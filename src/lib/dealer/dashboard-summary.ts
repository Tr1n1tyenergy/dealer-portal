import type { DealerOrderStatus } from "@prisma/client";
import { nairobiMonthStart } from "@/lib/time/nairobi";

export type SummaryOrder = {
  id: string;
  status: DealerOrderStatus;
  createdAt: Date;
  lines: { product: string; quantityLitres: number }[];
};

const TO_PAY: DealerOrderStatus[] = ["PFI_ISSUED", "AWAITING_PAYMENT", "PAYMENT_EXCEPTION"];
const ON_THE_WAY: DealerOrderStatus[] = ["RELEASED_TO_DEPOT", "LOADING", "LOADED", "DISPATCHED", "IN_TRANSIT"];
const NOT_COUNTED: DealerOrderStatus[] = ["CANCELLED", "REJECTED", "DRAFT"];

const part = (n: number, one: string, many: string) => (n === 1 ? `one ${one} is` : `${n} ${many} are`);

/**
 * The E2 dashboard's live parts (redesign spec §5): what needs the dealer, the second button, and this
 * month's litres. Orders arrive newest first, so [0] is the most recent of each kind.
 */
export function dashboardSummary(orders: SummaryOrder[], now: Date = new Date()) {
  const toPay = orders.filter((o) => TO_PAY.includes(o.status));
  const moving = orders.filter((o) => ON_THE_WAY.includes(o.status));
  const parts = [
    toPay.length ? `${part(toPay.length, "PFI", "PFIs")} waiting for payment` : null,
    moving.length ? `${part(moving.length, "delivery", "deliveries")} on the road` : null,
  ].filter(Boolean) as string[];
  const sentence = parts.length ? `${parts.join(" and ")}.` : "Nothing needs you right now.";

  const monthStart = nairobiMonthStart(now);
  const month = orders.filter((o) => o.createdAt >= monthStart && !NOT_COUNTED.includes(o.status));
  const litres = (product: string) =>
    month.reduce((sum, o) => sum + o.lines.filter((l) => l.product === product).reduce((s, l) => s + l.quantityLitres, 0), 0);
  const pmsLitres = litres("PMS");
  const agoLitres = litres("AGO");

  return {
    needsYou: sentence.charAt(0).toUpperCase() + sentence.slice(1),
    secondAction: toPay[0]
      ? { label: "Pay PFI", href: `/dealer/orders/${toPay[0].id}` }
      : moving[0]
        ? { label: "Track delivery", href: `/dealer/orders/${moving[0].id}` }
        : null,
    month: { litres: pmsLitres + agoLitres, pmsLitres, agoLitres, orders: month.length },
  };
}
