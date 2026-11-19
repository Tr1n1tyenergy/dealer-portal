# Pay PFI payments: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dealers pay a PFI in parts:
- by M-PESA code, or by manual bank payment;
- the M-PESA phone prompt is layout only for now;
- Bank transfer is "Coming soon".

Each manual payment becomes an Odoo `account.payment` draft. Staff confirm or flag each payment from
Needs Action and the order page. Confirm posts the draft in Odoo and Flag cancels it.

**Architecture:**
- `PaymentRecord` gains method, account, claim-key and Odoo fields.
- A pure module, `src/lib/orders/payments.ts`, owns the money and status rules.
- `service.ts` owns submit, review and the Odoo push.
- The Odoo client gains four payment methods (mock and live).
- A switch, `odooPaymentsEnabled()`, keeps live Odoo payment writes off until Adrian approves a test.

**Tech stack:** Next.js 15 app router, Prisma/Postgres, node:test + tsx, Odoo 17 JSON-RPC.

**Spec:** `docs/superpowers/specs/2026-11-19-pay-pfi-payments-design.md` (approved 19 Nov 2026).
Mockups: `D:\Downloads\pay-pfi-payments-mockups-2026-11-19.pdf`.

## Global constraints

- **No live Odoo writes.**
  - Tests use `ODOO_MODE=mock`, `ODOO_API_KEY=""` and `RESEND_API_KEY=""`.
  - DB tests run only on `tri_test`; the browser check runs on `tri_stress`. Never `tri_dev`.
- **Odoo payment flow switch.**
  - It runs when `ODOO_MODE=mock`, or when `ODOO_PAYMENTS_LIVE=1`.
  - Otherwise (live mode, flag off), confirming is portal-only, as today.
- **M-PESA limit:** KES 500,000 per payment (`MPESA_MAX_PER_PAYMENT = 500_000`).
- **Odoo ids:**

  | Account | journal | Manual method line | partner_bank |
  |---|---|---|---|
  | KCB 1289725640 | 23 | 28 | 492 |
  | Equity 1080281394514 | 6 | 1 | 367 |

  - KES currency id: 92.
  - M-PESA journal: 11.
- **Odoo draft fields:**
  - `is_internal_transfer: false`, `payment_type: "inbound"`, `partner_type: "customer"`
  - `partner_id`, `amount`, `currency_id: 92`, `date` (Nairobi today), `ref` (the bank reference)
  - `journal_id`, `payment_method_line_id`, `partner_bank_id`
  - `shift_id`, `sale_order_id` and `is_prepayment` are never set.
- **Money is compared in whole cents.** It is stored as a string `"1234.50"`, like `PaymentRecord.amount` today.
- **Customer names and real prices stay out of git.** Test fixtures use invented names.
- **Every new test file** is added to `package.json` `"test"` (unit) or `"test:db"` (DB).
- **Commits:** no `Co-Authored-By` trailer and no "Generated with Claude Code". Adrian pushes; never push.
- **Copy is taken from the spec.** It is sentence case, with no exclamation marks.

## Review focus

1. **Two staff press Confirm on the same payment at once.**
   - Expected: Odoo `action_post` is called once and one CONFIRMED history row is written. Covered by
     Task 5 `reviews a payment once when five confirmations arrive together`.
2. **A dealer sends two payments at the same moment that together exceed the balance.**
   - Expected: one is saved and the other is refused. Covered by Task 4
     `refuses the second of two simultaneous payments that together pass the balance`, using a row
     lock on the order.
3. **An M-PESA code typed in lower case or with spaces** (`" tkj4ab12cd "`).
   - Expected: it is treated as `TKJ4AB12CD`. A code that appears inside another ref but not as the
     last segment does not match. Covered by Task 1 and Task 3 tests.
4. **Odoo answers `action_post` with a state other than `posted`** (for example `awaitV`).
   - Expected: the payment stays waiting with the error shown, and it is not confirmed in the portal.
     Covered by Task 5 `keeps the payment waiting when Odoo does not post it`.
5. **Payments made before this release** have no method, claim key or Odoo fields.
   - Expected: they still show, and confirm portal-only. Covered by Task 5
     `confirms an older payment that has no Odoo draft`.

---

### Task 1: Payment rules and bank account ids

**Files:**
- Create: `src/lib/orders/payments.ts`, `src/lib/orders/payments.test.ts`
- Modify:
  - `src/lib/company/pfi-settings.ts`: add `odoo` ids to each `PFI_BANK_ACCOUNTS` entry, plus
    `MPESA_MAX_PER_PAYMENT = 500_000` and `MPESA_PAYBILL = ""` (Adrian supplies the number later;
    when it is empty the UI hides the line).
  - `src/lib/orders/state-machine.ts`: add `"AWAITING_PAYMENT"` to `PAYMENT_VERIFICATION`.
  - `package.json`: add the test to `"test"`.

**Interfaces (produces):**

```ts
export type PaymentLike = { amount: string; status: PaymentState };
export type PaymentTotals = { totalCents: number | null; confirmedCents: number; waitingCents: number; balanceCents: number | null };
export function toCents(text: string | null | undefined): number | null;            // "1,234.5" → 123450
export function centsToAmount(cents: number): string;                                // 123450 → "1234.50"
export function paymentTotals(pfiAmount: string | null | undefined, payments: PaymentLike[]): PaymentTotals;
export function orderStatusAfterReview(totals: PaymentTotals): "PAYMENT_CONFIRMED" | "PAYMENT_VERIFICATION" | "AWAITING_PAYMENT" | "PAYMENT_EXCEPTION";
export function parseMpesaCode(value: unknown): Parsed<string>;                      // Parsed from order-input.ts
export function parseSafaricomPhone(value: unknown): Parsed<string>;                 // → "2547XXXXXXXX"
export function bankAccountByNumber(accountNumber: unknown): (typeof PFI_BANK_ACCOUNTS)[number] | null;
export function paymentClaimKey(p: { method: PaymentMethod; mpesaCode?: string | null; bankAccountNumber?: string | null; bankReference?: string | null }): string | null;
```

**Rules:**
- Waiting means SUBMITTED or VERIFICATION. Balance = total − confirmed − waiting, floored at 0. It is
  null when there's no total.
- `orderStatusAfterReview` is used after a review:
  - total ≤ confirmed → `PAYMENT_CONFIRMED`;
  - otherwise, waiting > 0 → `PAYMENT_VERIFICATION`;
  - otherwise, confirmed > 0 → `AWAITING_PAYMENT`;
  - otherwise → `PAYMENT_EXCEPTION`.
  - The caller passes totals with the reviewed payment already set to CONFIRMED or REJECTED.
  - Ruling: all rejected with nothing confirmed keeps today's `PAYMENT_EXCEPTION`. If one was
    confirmed but the total is short → `AWAITING_PAYMENT` ("Part paid").
- **Claim key:**
  - M-PESA code → `MPESA:<CODE>`.
  - Manual → `BANK:<account>:<REF>`, where REF is upper case with all whitespace removed.
  - Otherwise null.

- [ ] **Step 1: Write the failing tests in `payments.test.ts`.**

```ts
assert.deepEqual(paymentTotals("7362144.00", [{ amount: "3000000.00", status: "CONFIRMED" }, { amount: "250000.00", status: "VERIFICATION" }, { amount: "1000000.00", status: "REJECTED" }]),
  { totalCents: 736214400, confirmedCents: 300000000, waitingCents: 25000000, balanceCents: 411214400 });
assert.equal(paymentTotals(null, []).balanceCents, null);
assert.equal(paymentTotals("100.00", [{ amount: "150.00", status: "CONFIRMED" }]).balanceCents, 0);
assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 100, waitingCents: 0, balanceCents: 0 }), "PAYMENT_CONFIRMED");
assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 40, waitingCents: 10, balanceCents: 50 }), "PAYMENT_VERIFICATION");
assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 40, waitingCents: 0, balanceCents: 60 }), "AWAITING_PAYMENT");
assert.equal(orderStatusAfterReview({ totalCents: 100, confirmedCents: 0, waitingCents: 0, balanceCents: 100 }), "PAYMENT_EXCEPTION");
assert.deepEqual(parseMpesaCode(" tkj4ab12cd "), { ok: true, value: "TKJ4AB12CD" });
assert.equal(parseMpesaCode("TKJ4AB12C").ok, false);        // 9 characters
assert.equal(parseMpesaCode("TKJ4AB-12CD").ok, false);
assert.deepEqual(parseSafaricomPhone("0712 345 678"), { ok: true, value: "254712345678" });
assert.deepEqual(parseSafaricomPhone("+254112345678"), { ok: true, value: "254112345678" });
assert.equal(parseSafaricomPhone("0812345678").ok, false);
assert.equal(bankAccountByNumber("1289725640")?.odoo.journalId, 23);
assert.equal(bankAccountByNumber("1080281394514")?.odoo.paymentMethodLineId, 1);
assert.equal(bankAccountByNumber("999"), null);
assert.equal(paymentClaimKey({ method: "MANUAL", bankAccountNumber: "1289725640", bankReference: " ft26 323kx9ql " }), "BANK:1289725640:FT26323KX9QL");
assert.equal(paymentClaimKey({ method: "MPESA_CODE", mpesaCode: "TKJ4AB12CD" }), "MPESA:TKJ4AB12CD");
assert.equal(canTransition("PAYMENT_VERIFICATION", "AWAITING_PAYMENT"), true);
```

  `PaymentMethod` doesn't exist until Task 2. For this task, declare
  `type PaymentMethod = "MANUAL" | "MPESA_CODE" | "MPESA_PROMPT"` locally in `payments.ts`. Task 2
  replaces it with the Prisma import.
- [ ] **Step 2:** `node --import tsx --test src/lib/orders/payments.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the module, the settings additions and the transition.
- [ ] **Step 4:** Run the same command and `npm test`. Expected: all pass. The `stages`/state-machine
  tests still pass.
- [ ] **Step 5:** Commit: `feat(payments): balance and review rules, bank account Odoo ids, M-PESA limit`.

### Task 2: Schema and migration

**Files:**
- Modify:
  - `prisma/schema.prisma`
  - `src/lib/orders/payments.ts`: import `PaymentMethod` from `@prisma/client`.
- Create: `prisma/migrations/20261119120000_payment_methods_odoo/migration.sql`

**Interfaces (produces):** the schema changes are:
- `enum PaymentMethod { MANUAL MPESA_CODE MPESA_PROMPT }`
- New `PaymentRecord` fields:
  - `method PaymentMethod @default(MANUAL)`
  - `bankAccountNumber String?`
  - `mpesaCode String?`
  - `claimKey String? @unique`
  - `odooPaymentId Int?`
  - `odooState String?`
  - `odooError String?`
  - `reviewNote String?`
  - `reviewedById String?`
  - `reviewedAt DateTime?`

Ruling: `claimKey @unique` replaces the spec's "mpesaCode @unique". A flagged payment sets
`claimKey = null`, so its reference can be sent again (spec "flagged don't count"). This also works
under `db push` on tri_test, which a partial index wouldn't.

- [ ] **Step 1:** Edit the schema, then generate the SQL without a database:
  ```
  git show main:prisma/schema.prisma > /tmp/old.prisma
  npx prisma migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261119120000_payment_methods_odoo/migration.sql
  ```
  Expected SQL: CREATE TYPE, ALTER TABLE ADD COLUMN ×10 and CREATE UNIQUE INDEX only. No DROP.
- [ ] **Step 2:** `npx prisma validate && npx prisma generate`. Then:
  - tri_test: `npx prisma db push` with the test env.
  - tri_stress: `npx prisma migrate deploy` with `DATABASE_URL` pointing at tri_stress.
  - Expected: both succeed.
- [ ] **Step 3:** `npm test && npm run test:db`. Expected: all pass. Existing payments get `method = MANUAL`.
- [ ] **Step 4:** Commit: `feat(payments): PaymentRecord method, claim key and Odoo fields (migration)`.

### Task 3: Odoo client payment methods

**Files:**
- Modify:
  - `src/lib/integrations/odoo/types.ts`
  - `config.ts`
  - `client.ts` (mock and unconfigured clients)
  - `live-client.ts`
  - `package.json`
- Create: `src/lib/integrations/odoo/payments.test.ts` (mock client and switch),
  `src/lib/integrations/odoo/live-client.payments.test.ts` (live payloads against a local HTTP server
  that records JSON-RPC bodies, the same pattern as `live-client.test.ts`)

**Interfaces (produces):**

```ts
export type PaymentDraftInput = {
  idempotencyKey: string; dealerCode: string; dealerName: string;
  odooPartnerId?: number | null; odooPartnerExternalId?: string | null;
  amount: string; date: string /* YYYY-MM-DD */; reference: string;
  journalId: number; paymentMethodLineId: number; partnerBankId: number;
};
export type OdooPaymentState = { id: number; state: string };
export type OdooMpesaPayment = { id: number; amount: string; date: string; state: string };
// OdooClient gains:
createPaymentDraft(input: PaymentDraftInput): Promise<OdooPaymentState>;
postPayment(id: number): Promise<OdooPaymentState>;
cancelPayment(id: number): Promise<OdooPaymentState>;
findMpesaPayment(code: string): Promise<OdooMpesaPayment | null>;
// config.ts:
ODOO_TRINITY.models.payment = "account.payment"; export const ODOO_KES_CURRENCY_ID = 92; export const ODOO_MPESA_JOURNAL_ID = 11;
export function odooPaymentsEnabled(): boolean; // mode === "mock" || process.env.ODOO_PAYMENTS_LIVE === "1"
```

**Live client:**
- `createPaymentDraft`:
  - Refactor `resolvePartnerId` to take `{ odooPartnerExternalId, odooPartnerId, dealerCode, dealerName }`.
  - Search for a `draft` payment with the same `partner_id`, `journal_id`, `amount` and `ref`. Reuse it
    if found.
  - Otherwise `create` with the Global Constraints fields.
- `postPayment`: `action_post` with `[[id]]`, then `read` `state`. `cancelPayment` uses `action_cancel`
  the same way.
- `findMpesaPayment`:
  - `search_read` on `[["journal_id","=",11],["state","=","posted"],["ref","ilike",code]]`, `limit: 5`.
  - Keep only rows whose `ref.trim()` ends with `" - " + code`.
  - None → `null`. More than one → throw "This M-PESA code matches more than one Odoo payment."
  - `amount` is returned with `toFixed(2)`.
- `createPaymentDraft`, `postPayment` and `cancelPayment` throw `Odoo payments are switched off.` when
  `!odooPaymentsEnabled()`.

**Mock client:**
- Ids count from 900001.
- Drafts post to `posted` and cancel to `cancel`.
- `findMpesaPayment` knows `TEST000001` → `"1000.00"` and `TEST500000` → `"500000.00"`, both
  `posted`. Anything else → null.

- [ ] **Step 1: Write the failing tests.**
  - Live (local server): `createPaymentDraft` sends `account.payment` `create` with exactly
    `{ is_internal_transfer: false, payment_type: "inbound", partner_type: "customer", partner_id: 4242, amount: 600000, currency_id: 92, date: "2026-11-19", ref: "FT26323KX9QL", journal_id: 23, payment_method_line_id: 28, partner_bank_id: 492 }`.
  - Live: when the search returns `[77]` → no `create` call, and the result is `{ id: 77, state: "draft" }`.
  - Live: `postPayment(77)` sends `action_post` with args `[[77]]`, then a `read`. When `read` answers
    `[{ state: "awaitV" }]` → returns `{ id: 77, state: "awaitV" }`.
  - Live: `findMpesaPayment("TKJ4AB12CD")` with rows whose refs are
    `"MP-25471 - Jane Doe - TKJ4AB12CD"` and `"MP-25471 - TKJ4AB12CD Ltd - XYZ1234567"` → returns only
    the first.
  - Live: with `ODOO_MODE=live` and no `ODOO_PAYMENTS_LIVE`, `createPaymentDraft` rejects with
    `/switched off/` and the server receives no request.
  - Mock: draft → post gives `"posted"`. `findMpesaPayment("TEST000001")` gives amount `"1000.00"`;
    `"NOPE000000"` gives `null`.
- [ ] **Step 2:** Run both files. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test`. Expected: all pass, including the existing `live-client.test.ts`.
- [ ] **Step 5:** Commit: `feat(odoo): account.payment draft/post/cancel and M-PESA lookup, behind odooPaymentsEnabled`.

### Task 4: Submit a payment (service) and push to Odoo

**Files:**
- Modify:
  - `src/lib/orders/service.ts`: replace `submitPayment` and add `pushPaymentToOdoo`.
  - `src/lib/orders/service.db.test.ts`: payments `describe`.
  - `src/lib/orders/actions.ts`: `paymentAction`, `checkMpesaCodeAction`.

**Interfaces:**
- Consumes: Task 1 rules, Task 2 fields, Task 3 client.
- Produces:

```ts
export async function submitPayment(params: {
  orderId: string; actorId: string; dealerOrganizationId: string;
  method: PaymentMethod; amount?: string; bankReference?: string; bankAccountNumber?: string; mpesaCode?: string; note?: string;
}): Promise<{ paymentId: string }>;
export async function pushPaymentToOdoo(paymentId: string): Promise<void>; // never throws; writes odooPaymentId/odooState or odooError
export async function lookUpMpesaCode(code: string): Promise<{ ok: true; amount: string; date: string } | { ok: false; error: string }>;
// actions.ts
export async function paymentAction(prev: ActionResult, formData: FormData): Promise<ActionResult>; // fields: orderId, method, amount, bankReference, bankAccountNumber, mpesaCode, note
export async function checkMpesaCodeAction(code: string): ReturnType<typeof lookUpMpesaCode>;     // requireDealer
```

**Behaviour** (all errors are `OrderInputError`, using the spec's wording):
- `MPESA_PROMPT` → "M-PESA prompts are not connected yet."
- `MPESA_CODE`:
  - The amount comes from `findMpesaPayment`. If it isn't found → "We can't find this M-PESA payment
    yet. It can take a few minutes to reach us. Check the code or try again shortly."
  - Store `odooPaymentId` and `odooState` from Odoo.
- `MANUAL`:
  - Needs a reference, a known account (`bankAccountByNumber`) and `parsePaymentAmount`.
- **One transaction:**
  1. `SELECT … FOR UPDATE` on the order row.
  2. Status must be AWAITING_PAYMENT, PAYMENT_EXCEPTION or PAYMENT_VERIFICATION.
  3. Recompute totals.
  4. Amount > balance → "This is more than the balance of KES {balance}."
  5. Insert the record with `claimKey`. A P2002 error → "This reference has already been used."
  6. Transitions: from AWAITING_PAYMENT or PAYMENT_EXCEPTION, go → PAYMENT_SUBMITTED →
     PAYMENT_VERIFICATION as today. From PAYMENT_VERIFICATION, don't transition.
- **After commit:** if the method is `MANUAL` and `odooPaymentsEnabled()`, run `pushPaymentToOdoo`.
  - The partner resolves the same way the quotation does (station first, then organisation, via
    `resolveOdooPartnerId`).
  - `date` = `nairobiToday()`.
  - `idempotencyKey` = `payment:<paymentId>`.
  - Errors are stored in `odooError`, trimmed to 300 characters.

- [ ] **Step 1: Write the failing DB tests** (mock Odoo; amounts on an order whose proforma is `"1000.00"`):
  - `takes a part payment and stays payable`: manual 400 → order PAYMENT_VERIFICATION, record MANUAL,
    `odooState "draft"`, `odooPaymentId > 900000`.
  - `takes a second payment while the first is waiting`: a second manual 300 → still
    PAYMENT_VERIFICATION, 2 waiting records.
  - `refuses a payment above the balance`: 400 waiting, then 601 → rejects with `/more than the balance of KES 600.00/`.
  - `refuses the second of two simultaneous payments that together pass the balance`: two parallel
    700s → exactly one record.
  - `refuses a reused bank reference on the same account`: `"FT1"` then `" ft 1 "` → second rejects
    `/already been used/`.
  - `takes an M-PESA payment by code with the amount from Odoo`: `TEST000001` → amount `"1000.00"`,
    method MPESA_CODE, `odooState "posted"`.
  - `refuses an unknown M-PESA code`: `NOPE000000` → rejects `/can't find this M-PESA payment/`, no record.
  - `lookUpMpesaCode says when a code is already claimed`: after `TEST000001` is saved,
    `lookUpMpesaCode("test000001")` → `{ ok: false, error: /already been used/ }`.
  - `keeps the payment and records the Odoo error when the draft fails`: a stubbed client throws →
    record saved, `odooError` set, `odooPaymentId` null. Inject via the existing `getOdooClient`
    seam; if there is none, add an optional `odoo` parameter defaulting to `getOdooClient()`.
- [ ] **Step 2:** `npm run test:db`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the service and actions. Update existing callers and tests of
  `submitPayment` to pass `method: "MANUAL"` plus an account.
- [ ] **Step 4:** `npm test && npm run test:db`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(payments): part payments by M-PESA code or manual reference; Odoo draft on submit`.

### Task 5: Review a payment (confirm or flag), with Odoo post and cancel

**Files:**
- Modify:
  - `src/lib/orders/service.ts`: replace `confirmPayment` with `reviewPayment`, and add `retryPaymentOdoo`.
  - `src/lib/orders/internal-order-actions.ts`
  - `service.db.test.ts`
  - The existing `internal-order-actions` / permissions tests that call `confirm-payment`.

**Interfaces (produces):**

```ts
export async function reviewPayment(paymentId: string, actorId: string, accept: boolean, note?: string): Promise<"done" | "stale" | "odoo-failed">;
export async function retryPaymentOdoo(paymentId: string, actorId: string): Promise<void>;
// internal actions: "confirm-payment" | "reject-payment" read formData "paymentId"; new "retry-payment-odoo".
```

**Behaviour:**
1. **Claim the payment.** `updateMany` where id, status ∈ {SUBMITTED, VERIFICATION} and
   `reviewedAt: null`; set `reviewedAt = now` and `reviewedById`. If the count is 0, return `"stale"`.
2. **Accept, when `odooPaymentsEnabled()`:**
   - MANUAL: draft if missing (`pushPaymentToOdoo`), then `postPayment`.
   - MPESA_CODE: `findMpesaPayment(code)` must be `posted` with the same amount.
   - Any error, or a state other than `posted`: release the claim (`reviewedAt = null`), set
     `odooError` and return `"odoo-failed"`.
   - Older payments without a claim key, and switch off: portal-only.
3. **Commit, in one transaction:**
   - Payment → CONFIRMED or REJECTED, with `reviewNote`.
   - Reject also sets `claimKey = null`.
   - `next = orderStatusAfterReview(totals)`. If `next !== order.status`, `recordTransition`; the note
     is "Payment confirmed — KES x" or "Payment needs review — <note>".
4. **Reject, MANUAL with an `odooPaymentId`, switch on:**
   - `cancelPayment` after commit.
   - On failure, `odooError = "Cancel the draft in Odoo by hand: <message>"`.
5. **`logActivity`:** `PAYMENT_CONFIRMED` / `PAYMENT_REJECTED`, `meta: { paymentId }`.

- [ ] **Step 1: Write the failing DB tests** (proforma `"1000.00"`):
  - `confirms a part payment and returns the order to awaiting payment`: 400 waiting → confirm →
    CONFIRMED, order AWAITING_PAYMENT, mock `odooState "posted"`.
  - `marks the order paid when confirmed payments cover the PFI`: 400 and 600 → confirm both → order
    PAYMENT_CONFIRMED.
  - `stays in verification while another payment waits`: 400 and 300 waiting → confirm the first →
    PAYMENT_VERIFICATION.
  - `flags a payment, cancels its draft and frees the reference`: flag → REJECTED, `claimKey null`,
    `odooState "cancel"`, order PAYMENT_EXCEPTION. Resubmitting `"FT1"` succeeds.
  - `reviews a payment once when five confirmations arrive together`: five parallel calls → one
    `"done"`, one CONFIRMED history row, `postPayment` called once (count calls with a wrapped mock).
  - `keeps the payment waiting when Odoo does not post it`: stub `postPayment` → `{ state: "awaitV" }`
    → returns `"odoo-failed"`, payment status unchanged, `reviewedAt null`, `odooError` mentions `awaitV`.
  - `confirms an older payment that has no Odoo draft`: a record created without method fields, with
    the switch off (`ODOO_MODE=live`, flag unset, client stub records no calls) → CONFIRMED, no Odoo calls.
  - Rewrite the existing `confirms a payment once when five confirmations arrive together` to use `reviewPayment`.
- [ ] **Step 2:** `npm run test:db`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement, and update `internal-order-actions.ts` and its tests.
- [ ] **Step 4:** `npm test && npm run test:db`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(payments): confirm/flag each payment; Confirm posts and Flag cancels the Odoo draft`.

### Task 6: Dealer Pay PFI popup

**Files:**
- Modify:
  - `src/components/dealer/pay-pfi-panel.tsx`, `pay-pfi-panel.css`
  - `src/lib/dealer/pay-pfi.ts`
  - `src/app/dealer/(portal)/layout.tsx`, `dashboard/page.tsx` (pass payments, plus the payable rule)
- Create: `src/lib/dealer/pay-pfi.test.ts` (in `"test"`).

**Interfaces:**
- Consumes: `paymentTotals`, `MPESA_MAX_PER_PAYMENT`, `MPESA_PAYBILL`, `paymentAction`, `checkMpesaCodeAction`.
- Produces:
  - `PayPfiPanelProps` gains `totalAmount: string`, `paidAmount: string`, `waitingAmount: string` and
    `balance: string`. It keeps `subtotal`, `vatAmount` and `vatRate` for the breakdown.
  - `toPayPfiProps(order & { payments: PaymentLike[] })` returns `null` when there's no PFI or the
    balance is 0.
  - `DEALER_PAYABLE_STATUSES` adds `PAYMENT_VERIFICATION`.

**UI** (match mockup boards 1–2; reuse the existing modal classes):
- **Method choice:** three methods: M-PESA, Manual payment, Bank transfer (`aria-disabled`, "Coming
  soon" badge, not focusable as a radio). Card and `DEALER_BANK_OPTIONS` are removed.
- **Balance box:** "Balance to pay", a progress bar, and the line "Paid so far / Waiting for
  confirmation" when either is non-zero.
- **M-PESA:**
  - Prompt part: phone and amount, validated with `parseSafaricomPhone` and 1 ≤ amount ≤
    min(balance, 500,000). "Send payment prompt" is disabled, with the spec's note.
  - "Already paid by M-PESA?" part: code field and **Check code** (calls `checkMpesaCodeAction`).
    Shows "Found: KES x paid <date>", then Submit sends `method=MPESA_CODE`.
- **Manual:** reference, account radios, amount pre-filled with the balance. Submit sends `method=MANUAL`.
- **After success:** "Payment sent to Trinity for confirmation. You'll see it as confirmed once
  checked." The trigger label is "Pay balance" when paid + waiting > 0.

- [ ] **Step 1: Write the failing unit test** for `toPayPfiProps`:
  - With proforma `"1000.00"`, payments `[{ amount: "400.00", status: "CONFIRMED" }, { amount: "100.00", status: "SUBMITTED" }]`
    → `balance "500.00"`, `paidAmount "400.00"`, `waitingAmount "100.00"`.
  - With a confirmed `"1000.00"` → `null`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the props, layout/dashboard queries (`include: { payments: true }`) and the popup.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Expected: clean.
- [ ] **Step 5:** Commit: `feat(dealer): Pay PFI popup with M-PESA, manual payment, part payments; card removed, bank transfer coming soon`.

### Task 7: Dealer order page while part paid

**Files:**
- Modify: `src/app/dealer/(portal)/orders/[id]/page.tsx`, `src/lib/orders/state-machine.ts`, its test.

**Interfaces (produces):** `export function paymentStepDetail(totals: PaymentTotals): string | null`.
It returns `"Part paid: KES 3.0M of 7.36M"` when 0 < confirmed < total, otherwise null. It uses the
existing compact money format if one exists, else `M` with up to 2 decimals.

**Page** (mockup board 3):
- The tracker step 3 secondary text uses `paymentStepDetail` when non-null.
- The hero chip shows "Part paid" in that case.
- A **Payments** card lists each payment newest first: method · reference (or M-PESA code), amount,
  date, account, and a status chip:
  - SUBMITTED / VERIFICATION → "Waiting for Trinity"
  - CONFIRMED → "Confirmed"
  - REJECTED → "Flagged", with `reviewNote` shown as `Flagged: "<note>"`.
- Paid / Waiting / Balance are shown on top.

- [ ] **Step 1: Failing unit tests:**
  - `paymentStepDetail({ totalCents: 736214400, confirmedCents: 300000000, waitingCents: 0, balanceCents: 436214400 })`
    → `"Part paid: KES 3.0M of 7.36M"`.
  - Confirmed 0 → `null`. Confirmed = total → `null`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the function and the page.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`. Expected: clean.
- [ ] **Step 5:** Commit: `feat(dealer): order page shows payments and part-paid progress`.

### Task 8: Staff Needs Action rows and per-payment Confirm card

**Files:**
- Modify:
  - `src/lib/retail/staff-home.ts`
  - `src/app/intelligence/retail/(home)/page.tsx`
  - `src/app/intelligence/retail/(home)/orders/[id]/page.tsx`
  - the staff order page CSS
- Test: `src/lib/retail/staff-home.test.ts` (create or extend; keep it in `"test"`).

**Interfaces (produces):**

```ts
export type WaitingPaymentOrder = { id: string; reference: string; dealerName: string;
  payments: { amount: string; method: PaymentMethod; bankAccountNumber: string | null; odooState: string | null; odooError: string | null; createdAt: Date }[] };
export function paymentTasks(orders: WaitingPaymentOrder[]): StaffHomeTask[]; // newest waiting payment first, max 5
```

**Task row:**
- `key`: `pay-<id>`
- `title`: `"<reference> · <dealerName>"`
- `description`: each payment as `"KES 250,000 by M-PESA"` or `"KES 600,000 manual (KCB)"`, joined
  with ` · `. If any payment has a draft, append `" · Draft in Odoo"`.
- `badge`: `"<n> waiting"` with `badgeTone "pending"`. If any payment has an `odooError`, the badge is
  `"Odoo error"` with `badgeTone "overdue"`.
- `actionLabel`: `"Review →"`; `actionHref`: `/intelligence/retail/orders/<id>`;
  `actionVariant "yellow"`; `icon "coins"`.

This replaces the single "Payment Confirmation" task. The panel's "View all tasks →" link stays.

**Order page card** (mockup board 5):
- One block per waiting payment, showing:
  - amount, and the method chip;
  - Account and Bank ref, or the M-PESA code;
  - Sent time;
  - the Odoo line:
    - "Draft created · journal … · Manual"
    - "Already posted in Odoo (M-PESA). Confirming links it, no new entry."
    - "Not in Odoo yet: <odooError>" with a **Retry Odoo** button (`action=retry-payment-odoo`)
    - "Odoo payments are off: Accounts records this in Odoo" when the switch is off;
  - a note input, and **Confirm payment** / **Flag**, which send `paymentId`.
- The "does not match PFI" note is removed. Overpaying can't happen any more.

- [ ] **Step 1: Failing unit tests for `paymentTasks`:**
  - 2 orders → 2 tasks, in newest-first order.
  - A description equal to `"KES 250,000 by M-PESA · KES 600,000 manual (KCB) · Draft in Odoo"`.
  - The `odooError` badge is `"Odoo error"`.
  - 7 orders → 5 tasks.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the function, the Home query (orders with payments in SUBMITTED or
  VERIFICATION), and the order page card.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`. Expected: clean.
- [ ] **Step 5:** Commit: `feat(staff): Needs Action row per order with waiting payments; confirm or flag each payment`.

### Task 9: Whole-branch verification and hand-over

- [ ] **Step 1:** `npm test`, `npm run test:db` (tri_test), `npx tsc --noEmit`, `npm run lint`,
  `npm run build`. Expected: all green. Record the counts.
- [ ] **Step 2:** Run the built server on tri_stress (`ODOO_MODE=mock`, blank keys) and check in the
  browser with the existing Playwright tooling.
  - Sizes: 1366, 820 and 390 in Chromium, Firefox and WebKit. Expected: no sideways scroll and no text
    under 12px.
  - Flow:
    1. dealer pays 400 manual;
    2. dealer pays by code `TEST000001`;
    3. staff Home shows the row;
    4. Review opens the order;
    5. Confirm one payment → "Part paid";
    6. confirm the rest → Paid → Release to depot is available.
- [ ] **Step 3:** Save PR text to `D:\Downloads\pr-pay-pfi-payments.md`. It covers:
  - what changed;
  - the migration `20261119120000_payment_methods_odoo` (staging, then production, before deploy);
  - `ODOO_PAYMENTS_LIVE` stays unset in production;
  - Finance questions;
  - test counts.
  No attribution lines.
- [ ] **Step 4:** Final whole-branch review (per the execution skill), fix pass, then hand Adrian the push command.
