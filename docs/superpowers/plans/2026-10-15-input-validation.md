# Input Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bad input on dealer, depot and API paths is refused with a clear message instead of a 500 or bad stored data.

**Architecture:** One client-safe rules module (`order-input.ts`) used by the server actions, the order service (defence in depth) and the forms' browser limits. Dealer actions return `{ error }` for `useActionState`; a shared `readJson()` turns malformed bodies into 400s; zod schemas gain `.max()` limits.

**Tech Stack:** Next.js 15 server actions + React 19 `useActionState`, zod, Prisma 6, `node:test` + tsx.

**Spec:** `docs/superpowers/specs/2026-10-14-input-validation-design.md`

## Global Constraints

- `MAX_LITRES = 100_000`; `DELIVERY_WINDOW_DAYS = 90`; "today" is the calendar date in `Africa/Nairobi`.
- Messages (verbatim): `Quantity must be a whole number up to 100,000 L.` · `Enter a quantity for PMS or AGO.` · `Choose a delivery date between <D Mon YYYY> and <D Mon YYYY>.` · `Enter the amount paid, e.g. 1,070,150.00.` · `Unknown depot action.` · `Request body must be valid JSON.` · `Invalid date filter.`
- Payment amounts are stored normalised with exactly 2 decimals, no commas (`1,070,150` → `1070150.00`).
- Size limits: names/department 100, email 254, titles/names of reports, presentations, note sessions 200, description/notes/presenter 2,000, ids/tokens 200, passwords 200, `participants`/`permissions` ≤ 50 items of ≤ 254 chars, `stationCodes` ≤ 20.
- No schema change, no migration. Portals: Dealer, Depot, Admin/Staff APIs.

## Review Focus

1. A delivery date that is "today" in Nairobi but already "tomorrow" in UTC (or vice versa) around midnight → today is accepted, yesterday refused. Test in Task 1 with an injected `now`.
2. A payment typed with spaces or a currency prefix (`" 1,000.50 "`, `"KES 1000"`) → trailing/leading spaces accepted, `KES` refused with the amount message. Test in Task 1.
3. An empty request body (`Content-Length: 0`) on a JSON route → 400, not 500. Test in Task 2 (`readJson`).
4. A launch-blocked dealer submitting Place Order → the form shows the block reason (no generic error page). Covered in Task 3 (action returns the reason) and checked live in Task 5.
5. Litres typed as `5e3`, `1000.5` or `-0` → refused (whole numbers only), `0` and blank → 0. Test in Task 1.

---

### Task 1: Order input rules

**Files:**
- Create: `src/lib/orders/order-input.ts`
- Test: `src/lib/orders/order-input.test.ts`
- Modify: `package.json` (add to `"test"`)

**Interfaces:**
- Produces:
  - `type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }`
  - `class OrderInputError extends Error` (name `"OrderInputError"`)
  - `MAX_LITRES`, `DELIVERY_WINDOW_DAYS`, `DEPOT_ACTIONS = ["accept","complete","dispatch","deliver","close"] as const`, `type DepotAction`
  - `parseLitres(value: unknown): Parsed<number>` — blank/undefined → 0; digits only (no sign, decimal point or exponent); ≤ `MAX_LITRES`
  - `parseOrderLines(input: { pms: unknown; ago: unknown }): Parsed<{ product: "PMS" | "AGO"; quantityLitres: number }[]>` — drops zero lines; empty → `Enter a quantity for PMS or AGO.`
  - `nairobiToday(now?: Date): string` (`YYYY-MM-DD`) and `deliveryWindow(now?: Date): { min: string; max: string }`
  - `parseDeliveryDate(value: unknown, now?: Date): Parsed<string | null>` — blank → null; real `YYYY-MM-DD` within the window
  - `parsePaymentAmount(value: unknown): Parsed<string>` — trims; `^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$`; > 0; returns normalised string
  - `isDepotAction(value: unknown): value is DepotAction`

- [ ] **Step 1: Failing tests** (`now = new Date("2026-10-15T09:00:00+03:00")` unless noted)
  - litres: `"5000"`→5000, `""`→0, `"0"`→0, `"100000"`→100000; refused with the quantity message: `"100001"`, `"-5"`, `"1000.5"`, `"5e3"`, `"abc"`, `"2147483648"`
  - lines: `{pms:"5000",ago:""}`→`[{product:"PMS",quantityLitres:5000}]`; `{pms:"0",ago:"0"}`→`Enter a quantity for PMS or AGO.`
  - date: `""`→null; `"2026-10-15"` ok; `"2027-01-13"` ok (today+90); refused `"2026-10-14"`, `"2027-01-14"`, `"2026-02-30"`, `"banana"`; refused message equals `Choose a delivery date between 15 Oct 2026 and 13 Jan 2027.`
  - Nairobi midnight: `now = new Date("2026-10-14T21:30:00Z")` (00:30 on 15 Oct in Nairobi) → `nairobiToday(now) === "2026-10-15"` and `"2026-10-14"` refused
  - amount: `"1,070,150.00"`→`"1070150.00"`; `"1070150"`→`"1070150.00"`; `" 1,000.5 "`→`"1000.50"`; refused with the amount message: `"-999999abc"`, `"0"`, `"0.00"`, `"1.234"`, `"KES 1000"`, `"1,00,000"`, `""`
  - depot: `isDepotAction("accept")` true; `"bogus"` false
- [ ] **Step 2: Run** `node --import tsx --test src/lib/orders/order-input.test.ts` → FAIL (module not found)
- [ ] **Step 3: Implement** `order-input.ts` (no server imports; date formatting via `Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", year: "numeric" })`)
- [ ] **Step 4: Run** → PASS; add to `"test"`; `npm test` passes
- [ ] **Step 5: Commit** `feat(orders): shared rules for order, date, payment and depot input`

### Task 2: JSON bodies and API size limits (B1, B2)

**Files:**
- Create: `src/lib/http/read-json.ts`, Test: `src/lib/http/read-json.test.ts`
- Modify: the 15 routes that call `await req.json()` (`src/app/api/{auth/activate,auth/forgot-password,auth/reset-password,messaging/conversations,messaging/conversations/[id]/messages,messaging/typing,note-sessions,note-sessions/[id],presentations,reports,retail/invite/dealer,retail/invite/staff,retail/users/[id],users,users/[id]}/route.ts`), `src/app/api/reports/route.ts` (GET date filter)
- Modify: `package.json` (`"test"`)

**Interfaces:**
- Produces: `readJson(req: Request): Promise<unknown | undefined>` — `undefined` when the body is empty or not valid JSON; `const INVALID_JSON = "Request body must be valid JSON."`

- [ ] **Step 1: Failing tests** — valid object → object; `"{oops"` → undefined; empty body → undefined; `"null"` → null
- [ ] **Step 2: Run** `node --import tsx --test src/lib/http/read-json.test.ts` → FAIL
- [ ] **Step 3: Implement** `readJson`; in every listed route replace `await req.json()` with `const body = await readJson(req); if (body === undefined) return jsonError(INVALID_JSON, 400);`
- [ ] **Step 4: Reports GET** — when `from` or `to` is present and `new Date(x)` is invalid → `jsonError("Invalid date filter.", 400)`
- [ ] **Step 5: Size limits** — add the Global Constraints `.max()` values to every zod schema in those routes (`z.string().min(1).max(100)` etc.; arrays `.max(50)` with element `.max(254)`)
- [ ] **Step 6: Verify** `npx tsc --noEmit`; `npm test`; `npm run test:db` (all pass)
- [ ] **Step 7: Commit** `fix(api): 400 for malformed JSON and bad date filters; size limits on request fields (B1, B2)`

### Task 3: Server actions and service checks (C4, C8, C10, P4)

**Files:**
- Modify: `src/lib/orders/actions.ts`, `src/lib/orders/service.ts` (`submitDealerOrder` ~L78, `submitPayment` ~L345, `applyDepotAction` ~L444)
- Test: `src/lib/orders/order-input.db.test.ts` (`_test` guard + fixtures like `depot-access.db.test.ts`); `package.json` (`"test:db"`)

**Interfaces:**
- Consumes: Task 1 (`parseOrderLines`, `parseDeliveryDate`, `parsePaymentAmount`, `isDepotAction`, `OrderInputError`)
- Produces:
  - `type ActionResult = { error: string } | null`
  - `placeOrderAction(prev: ActionResult, formData: FormData): Promise<ActionResult>` (redirects on success)
  - `paymentAction(prev: ActionResult, formData: FormData): Promise<ActionResult>` (returns `null` on success)
  - `depotOrderAction(formData: FormData): Promise<void>` unchanged signature, never throws for an unknown action or a refused order

- [ ] **Step 1: Failing DB tests**
  - `submitDealerOrder refuses 100,001 litres` → rejects with `OrderInputError`, no order created
  - `submitDealerOrder refuses a past delivery date` → rejects, no order created
  - `submitPayment refuses a non-numeric amount and keeps no record`
  - `submitPayment stores the amount normalised` → `"1,070,150"` stored as `"1070150.00"`
  - `applyDepotAction refuses an unknown action` → rejects with `OrderInputError("Unknown depot action.")`, order unchanged
- [ ] **Step 2: Run** `node --env-file-if-exists=.env.test.local --import tsx --test src/lib/orders/order-input.db.test.ts` → FAIL
- [ ] **Step 3: Service** — validate with the Task 1 parsers at the top of the three functions and `throw new OrderInputError(message)`; `submitPayment` stores the normalised amount
- [ ] **Step 4: Actions** — `placeOrderAction`: return `{ error: dealerCommercialOrdersBlockedReason() }` when blocked; parse lines/date first and return `{ error }`; catch `OrderInputError` from the service → `{ error: e.message }`; other errors rethrow. `paymentAction`: parse amount → `{ error }`; catch `OrderInputError`, `InvalidOrderTransition`, `StaleOrderTransition` → `{ error: "This order can't take a payment right now. Refresh the page." }`. `depotOrderAction`: return early when `!isDepotAction(action)`; catch `OrderInputError` and `Error("Order not found.")` → return
- [ ] **Step 5: Run** → PASS; add the file to `"test:db"`; `npm run test:db` passes; `npx tsc --noEmit` fails only where forms still use the old signatures (fixed in Task 4)
- [ ] **Step 6: Commit** together with Task 4 if tsc needs the forms (record a ruling)

### Task 4: Forms show the errors

**Files:**
- Modify: `src/components/dealer/place-order-form.tsx` (form at ~L252, quantity buttons ~L358–433, date input ~L317)
- Create: `src/components/dealer/payment-form.tsx`
- Modify: `src/app/dealer/(portal)/orders/[id]/page.tsx` (~L411–436: replace the inline form with `<PaymentForm orderId amountDue />`)

**Interfaces:**
- Consumes: Task 3 action signatures; Task 1 `MAX_LITRES`, `deliveryWindow()`
- Produces: `PaymentForm({ orderId, amountDue }: { orderId: string; amountDue: string | null })`

- [ ] **Step 1: Place Order** — `const [state, formAction] = useActionState(placeOrderAction, null)`; `guardSubmit` calls `formAction` only on the review step; show `state?.error` above the Submit button (`role="alert"`, existing error colours); quantity buttons and quick picks cap at `MAX_LITRES`; date input `min`/`max` from `deliveryWindow()`
- [ ] **Step 2: Payment form** — same fields as today; `useActionState(paymentAction, null)`; error under the amount field; amount input `inputMode="decimal"`; submit button disabled while pending
- [ ] **Step 3: Verify** `npx tsc --noEmit`, `npm run lint` (no new warnings), `npm run build`
- [ ] **Step 4: Commit** `fix(dealer): order and payment forms show validation errors (C4, C8, P4)`

### Task 5: End-to-end check

- [ ] **Step 1:** Production build in a scratch copy, fresh seeded `tri_stress`, `RESEND_API_KEY=""`, `TRI_ALLOW_MOCK_DEALER_ORDERS="1"` on :3997 and default on :3998; confirm email off on the running server first.
- [ ] **Step 2:** Probe: B1 bad JSON + `from=notadate` → 400; B2 200 KB title and 50,000 participants → 400; C4 `-999999abc` → error result, nothing stored; C8 `banana` and a past date → error, no order; C10 `bogus` → no 500, order unchanged; P4 2,147,483,648 L and 100,001 L → error, no order; launch-blocked (:3998) submit → block reason returned; a normal order and payment still succeed (amount stored normalised).
- [ ] **Step 3:** User checks the inline messages on Place Order and Payment in a browser.
- [ ] **Step 4:** Clean up (stop servers by port PID, drop DB, delete copy); push/PR commands.
