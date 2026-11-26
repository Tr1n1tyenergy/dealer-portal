"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Loader2 } from "lucide-react";
import { onGroupedInput } from "@/lib/forms/numeric-text";
import { saveStockReceiptAction } from "@/lib/stock-reporting/actions";
import { formatLitresExact, formatLitresFixed, parseLitresInput } from "@/lib/stock-reporting/pump-calc";
import { addLitres } from "@/lib/stock-reporting/stock-receipt";
import type { StockReceiptOrderDto, StockReceiptTankDto } from "@/lib/stock-reporting/stock-receipt";
import { cn } from "@/lib/utils";
import "@/app/dealer/dealer-stock-wizard.css";

function draftFromOrders(orders: StockReceiptOrderDto[]) {
  const next: Record<string, Record<string, string>> = {};
  for (const order of orders) {
    next[order.id] = {};
    for (const line of order.savedLines) {
      next[order.id]![line.tankKey] = formatLitresExact(line.litres);
    }
  }
  return next;
}

export function StockReceiptPanel({
  stationId,
  tanks,
  orders,
  reportClosed,
}: {
  stationId: string;
  tanks: StockReceiptTankDto[];
  orders: StockReceiptOrderDto[];
  reportClosed: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => draftFromOrders(orders));
  const [error, setError] = useState<string | null>(null);
  const [errorOrderId, setErrorOrderId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const savedByOrder = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const order of orders) {
      map.set(order.id, new Map(order.savedLines.map((line) => [line.tankKey, line.litres])));
    }
    return map;
  }, [orders]);

  function litresFor(orderId: string, tankKey: string) {
    return parseLitresInput(drafts[orderId]?.[tankKey] ?? "") ?? 0;
  }

  function received(orderId: string, product: "PMS" | "AGO") {
    return tanks
      .filter((tank) => tank.product === product)
      .reduce((sum, tank) => addLitres(sum, litresFor(orderId, tank.tankKey)), 0);
  }

  function stockAfter(orderId: string, tankKey: string) {
    const tank = tanks.find((row) => row.tankKey === tankKey);
    if (!tank) return 0;
    let level = tank.bookLitres;
    for (const order of orders) {
      level = addLitres(level, litresFor(order.id, tankKey));
    }
    return level;
  }

  function save(order: StockReceiptOrderDto) {
    setError(null);
    setErrorOrderId(order.id);
    setFieldErrors({});
    setPendingId(order.id);
    startTransition(async () => {
      const result = await saveStockReceiptAction({
        stationId,
        orderId: order.id,
        allocations: tanks.map((tank) => ({
          tankKey: tank.tankKey,
          litres: litresFor(order.id, tank.tankKey),
        })),
      });
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
    });
  }

  if (tanks.length === 0) {
    return (
      <section className="ssr__card ssr-rtt__empty">
        <h2 className="ssr__card-title">Stock Receipt</h2>
        <p className="ssr__card-sub">
          Add this station&apos;s tanks in Tank Management before receipting a delivery.
        </p>
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section className="ssr__card">
        <h2 className="ssr__card-title">Stock Receipt</h2>
        <p className="ssr__card-sub">
          Completed orders for this station appear here. Split each delivery across the tanks that
          received it. Those litres update today&apos;s opening stock.
        </p>
        <div className="ssr-receipt__tanks" aria-label="Station tanks">
          {tanks.map((tank) => (
            <p key={tank.tankKey}>
              <Layers size={14} strokeWidth={2.25} aria-hidden />
              <strong>{tank.label}</strong>
              <span>{tank.product}</span>
              <span>{formatLitresFixed(tank.capacityLitres)} L capacity</span>
            </p>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="ssr-receipt__list">
      {reportClosed ? (
        <p className="ssr__error" role="status">
          Today&apos;s stock report is closed, so receipts wait until the next reporting day.
        </p>
      ) : null}
      {error ? (
        <p className="ssr__error" role="alert">
          {error}
        </p>
      ) : null}
      {orders.map((order) => {
        const pmsOrdered = order.orderedPms;
        const agoOrdered = order.orderedAgo;
        const pmsGot = received(order.id, "PMS");
        const agoGot = received(order.id, "AGO");
        const busy = pending && pendingId === order.id;
        return (
          <section key={order.id} className="ssr__card" aria-labelledby={`receipt-${order.id}`}>
            <div className="ssr__card-head">
              <div>
                <h2 id={`receipt-${order.id}`} className="ssr__card-title">
                  {order.reference}
                </h2>
                <p className="ssr__card-sub">
                  Completed {order.deliveredLabel}. Enter the litres that went into each tank. The
                  total for a product cannot be more than the order.
                </p>
              </div>
            </div>
            <div className="ssr-receipt__meta">
              <span>PMS ordered {formatLitresFixed(pmsOrdered)} L</span>
              <span>AGO ordered {formatLitresFixed(agoOrdered)} L</span>
            </div>
            <div className="ssw__table-wrap">
              <table className="ssw__table">
                <thead>
                  <tr>
                    <th scope="col">Tank</th>
                    <th scope="col">Product</th>
                    <th scope="col">Capacity (L)</th>
                    <th scope="col">Litres received</th>
                    <th scope="col">Stock after receipt (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {tanks.map((tank) => {
                    const onOrder = tank.product === "PMS" ? pmsOrdered > 0 : agoOrdered > 0;
                    const value = drafts[order.id]?.[tank.tankKey] ?? "";
                    const fieldError = errorOrderId === order.id ? fieldErrors[tank.tankKey] : undefined;
                    return (
                      <tr key={tank.tankKey}>
                        <td className="ssw__tank-name-cell">
                          <span className="ssw__pump-cell">
                            <Layers size={15} strokeWidth={2.25} aria-hidden />
                            {tank.label}
                          </span>
                        </td>
                        <td>{tank.product}</td>
                        <td>{formatLitresFixed(tank.capacityLitres)}</td>
                        <td>
                          {onOrder ? (
                            <>
                              <input
                                className={cn("ssw__input", fieldError && "is-invalid")}
                                inputMode="decimal"
                                value={value}
                                disabled={order.locked || busy}
                                aria-label={`${tank.label} litres received from ${order.reference}`}
                                onChange={onGroupedInput(true, (next) => {
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: { ...prev[order.id], [tank.tankKey]: next },
                                  }));
                                })}
                              />
                              {fieldError ? <span className="ssw__field-error">{fieldError}</span> : null}
                            </>
                          ) : (
                            <span className="ssr-receipt__na">Not on this order</span>
                          )}
                        </td>
                        <td>{formatLitresFixed(stockAfter(order.id, tank.tankKey))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ssr-receipt__totals">
              <span>
                PMS receipted {formatLitresFixed(pmsGot)} / {formatLitresFixed(pmsOrdered)} L
              </span>
              <span>
                AGO receipted {formatLitresFixed(agoGot)} / {formatLitresFixed(agoOrdered)} L
              </span>
            </div>
            <div className="ssr-receipt__actions">
              <button
                type="button"
                className="ssw__btn ssw__btn--primary"
                disabled={order.locked || busy}
                onClick={() => save(order)}
              >
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                {savedByOrder.get(order.id)?.size ? "Update receipt" : "Receipt stock"}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
