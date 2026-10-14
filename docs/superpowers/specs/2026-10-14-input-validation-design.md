# Input validation (B1, B2, C4, C8, C10, P4) — design

Date: 2026-10-14 · Portals: **Dealer** (Place Order, Payment), **Depot** (order actions), **Admin/Staff APIs** · Branch: `fix/input-validation`

## Problem (from the 13 Oct stress test)

| ID | Today |
|---|---|
| B1 | Malformed JSON on any of the 15 `await req.json()` routes → 500; `GET /api/reports?from=notadate` → 500 |
| B2 | Request schemas have no size limits (a 200 KB report title and 50,000 note-session participants are stored) |
| C4 | The payment amount is stored as typed (`-999999abc` accepted) |
| C8 | Delivery date not validated (`banana` → 500, `2001-01-01` accepted) |
| C10 | Unknown depot action (`bogus`) → 500 (TypeError) |
| P4 | 2,147,483,648 L → raw 500 (Postgres integer overflow); no business limit on quantity |

Server actions that throw are shown by Next.js production builds as a generic error page, so fixing the dealer
forms means the actions must **return** errors and the forms must **show** them.

## Rules — `src/lib/orders/order-input.ts` (client-safe, pure)

| Field | Rule | Message (verbatim) |
|---|---|---|
| PMS / AGO litres | blank = 0; whole number; 0 ≤ n ≤ **100,000** per product | `Quantity must be a whole number up to 100,000 L.` |
| Order lines | at least one product above 0 | `Enter a quantity for PMS or AGO.` |
| Delivery date | optional; when given: `YYYY-MM-DD`, a real calendar date, from **today in Africa/Nairobi** to **today + 90 days** inclusive | `Choose a delivery date between <today> and <today+90>.` (dates as `D Mon YYYY`, e.g. `14 Oct 2026`) |
| Payment amount | positive; digits with optional thousands commas and at most 2 decimals; stored normalised with 2 decimals (`1,070,150` → `1070150.00`) | `Enter the amount paid, e.g. 1,070,150.00.` |
| Depot action | one of `accept`, `complete`, `dispatch`, `deliver`, `close` | `Unknown depot action.` |

Exports: `MAX_LITRES = 100_000`, `DELIVERY_WINDOW_DAYS = 90`, `parseLitres(value)`, `parseOrderLines({ pms, ago })`,
`parseDeliveryDate(value, now = new Date())`, `parsePaymentAmount(value)`, `isDepotAction(value)` — each parser returns
`{ ok: true, value } | { ok: false, message }`.

## Server actions — `src/lib/orders/actions.ts`

- New result type `ActionResult = { error: string } | null` (null = success / redirected).
- `placeOrderAction(prev, formData)` and `paymentAction(prev, formData)` take the `useActionState` signature, validate
  with the rules above and **return `{ error }`** instead of throwing. Business refusals from the service that are meant
  for the dealer (launch gate, wrong order state, not found) are also returned as `{ error: message }`; unexpected
  errors still throw.
- `depotOrderAction(formData)` keeps its form signature; an unknown action or a refused order ("Order not found.")
  returns without throwing (no 500), nothing changes.
- `submitDealerOrder` / `submitPayment` / `applyDepotAction` re-check the same rules (defence in depth for any other
  caller).

## Forms

- **Place Order** (`src/components/dealer/place-order-form.tsx`): `useActionState(placeOrderAction, null)`; the error
  appears above the Submit button; the wizard state (station, quantities, date) is kept. Inputs get
  `min=0 max=100000 step=1`; the date picker gets `min=today max=today+90`.
- **Payment** (dealer order page): the form moves into a small client component
  `src/components/dealer/payment-form.tsx` using `useActionState(paymentAction, null)`; error shown under the amount
  field; `inputMode="decimal"`.
- **Depot**: no visual change (bad values only arrive from crafted requests).

## APIs

- **B1** — `readJson(req)` in `src/lib/api-auth.ts` returns the parsed body or `null`; every route that called
  `await req.json()` uses it and answers **400 `Request body must be valid JSON.`** on `null`.
  `GET /api/reports`: invalid `from` / `to` → **400 `Invalid date filter.`**
- **B2** — `.max()` on request schemas: first/last name 100, department 100, email 254, report/presentation/note-session
  title or name 200, description / notes / presenter 2,000, ids and tokens 200, `participants` and `permissions`
  arrays at most 50 items of at most 254 chars, `stationCodes` at most 20, passwords at most 200. Message bodies keep
  their existing 8,000 limit.

## Testing

- Unit (`src/lib/orders/order-input.test.ts`): every rule's accept/refuse cases incl. boundaries (100,000 / 100,001,
  today / yesterday / today+90 / today+91 in Nairobi time, `1,070,150.00`, `-5`, `1.234`, `abc`, `0`), and
  `readJson` with valid / malformed bodies.
- Database: existing suites stay green.
- Live re-run of the stress-test attacks on a production build (email explicitly off and verified): B1 both cases → 400,
  B2 → 400, C4 → refused with the message and nothing stored, C8 `banana` / past → refused, C10 → no 500 and order
  unchanged, P4 → refused with the message; plus a normal order and payment still succeed.
- User checks the inline messages on Place Order and Payment in a browser.

No schema change, no migration.
