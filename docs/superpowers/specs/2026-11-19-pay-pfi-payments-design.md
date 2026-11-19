# Pay PFI: M-PESA, manual payments, instalments and Odoo payments: design

Status: APPROVED by Adrian 19 Nov 2026. Branch `feat/pay-pfi-payments`.

## Why

Today a dealer pays the PFI by bank transfer, types the bank reference into the portal, and staff
confirm it. Accounts then types the same payment into Odoo by hand: they create the
`account.payment` draft and press Confirm. That is double work, and the portal's records and Odoo
can disagree.

Dealers also want to pay large PFIs in parts, for example several M-PESA payments.

This change does three things:
- Dealers can pay in parts, by M-PESA or by any manual payment.
- The portal fills in the Odoo payment draft itself.
- Staff's Confirm Payment in the portal confirms (posts) that payment in Odoo.

## Goals

1. **The Pay PFI popup offers three payment methods:**
   - **M-PESA:** the dealer chooses the amount, which allows instalments.
   - **Manual payment:** the dealer gives the bank reference and the Trinity account they paid into.
   - **Bank transfer:** greyed out and marked "Coming soon".
   - **Card is removed.**
2. **Every payment may be part of the balance.**
   - The order stays payable until confirmed payments cover the PFI total.
   - Only then does it become Paid and can be released to a depot.
3. **A manual payment creates an Odoo `account.payment` draft** as soon as the dealer submits it, with
   the 10 fields Adrian listed (see "Odoo payment draft").
4. **Staff confirm each payment:**
   - It appears under **Needs Action** on staff Home, which links to the order's page.
   - **Confirm payment** posts the Odoo draft (`action_post`).
   - **Flag** cancels the draft.
5. **M-PESA code lookup:** a dealer who has already paid Trinity's paybill types the M-PESA code. The
   portal finds that payment in Odoo and takes the amount from Odoo. The same code can never be
   claimed twice.
6. **M-PESA phone prompt (Daraja STK push): layout only.**
   - The dealer enters a phone number and an amount.
   - The "Send payment prompt" button is visibly not connected yet.
   - It gets wired up once Daraja credentials exist (separate piece of work).

## Non-goals

- Connecting Daraja (STK push or callbacks). Only the layout is built now.
- Bank transfer as a live payment method (it is "Coming soon").
- Writing to Odoo's existing M-PESA payments, for example moving them to the dealer's customer
  record (see Finance questions).
- Odoo's customer prepayment wallet (`is_prepayment`, `credit.prepayment.ledger`) and the `shift_id`
  and `sale_order_id` fields. They are left empty.
- Refunds and overpayments. The portal stops a dealer from paying more than the balance.

## Anti-goals (failure even if it "works")

- **Counting money twice:**
  - The portal must never create an Odoo payment for an M-PESA payment, because Odoo already
    records those itself.
  - The same bank reference or M-PESA code must never be accepted twice.
- **Portal and Odoo disagreeing:**
  - A payment is shown as confirmed in the portal only once Odoo says it is posted. In mock mode, the
    mock says so.
- **Testing on Trinity's live books:**
  - No live Odoo write happens until Adrian approves a test.
  - Everything is built and tested against the mock Odoo client.

## What Odoo looks like (read-only probe, 19 Nov)

- **API user:** company 1, TRINITY ENERGY (KENYA) LIMITED. It may read, create and write
  `account.payment`.
- **Payment states:** `draft`, `posted`, `cancel`, `awaitV`, `awaitA`.
  - No payment has ever been in `awaitV` or `awaitA`.
  - So `action_post` is expected to go straight to `posted`. This is proven only by the first approved
    live test.
- **The bank accounts on the PFI map to these Odoo records:**

| PFI account | journal_id | payment_method_line_id (Manual, inbound) | partner_bank_id |
|---|---|---|---|
| KCB 1289725640 | 23 "1289725640 - KCB Bank Kenya Limited 2 - Kes" (BNK1) | 28 | 492 |
| Equity 1080281394514 | 6 "Equity - KES" (EQT) | 1 | 367 |

  - Journal 12 "KCB - KES (1280625341)" also points at bank account 492. It is not used, because the
    screenshot and recent Accounts entries use journal 23.
- **Currency:** KES is `res.currency` 92. Journals 23 and 6 have no currency of their own, so the
  company currency applies. The portal sets `currency_id` = 92 explicitly.
- **Duplicate references:** Odoo has a duplicate bank-reference check (`bank_reference_key`,
  `bank_ref_override_reason`). A reused reference will probably be refused by Odoo. The portal shows
  Odoo's message to staff.
- **M-PESA in Odoo:**
  - Paybill payments arrive via `mpesa.c2b.callback` and are posted automatically in journal 11
    "Mpesa" (13.6k payments).
  - `ref` looks like `xx-<14 digits> - <payer name> - <M-PESA code>`. The code is 10 characters, A–Z
    and 0–9.
  - 13,482 of 13,593 are on one non-company customer, not on dealers.

## Approaches considered

- **A. Extend today's payment flow (chosen by Adrian).**
  - `PaymentRecord` gains method, account and Odoo fields.
  - A manual payment's Odoo draft is created when the dealer submits.
  - Confirm posts the draft and Flag cancels it.
  - If Odoo is down, the payment still saves and staff get "Retry Odoo", the same pattern quotations
    use today.
- **B. Create the Odoo payment only at staff confirm.**
  - This keeps Odoo free of unchecked drafts.
  - Rejected: it contradicts "draft when the dealer pays", and Accounts lose sight of pending payments.
- **C. Track instalments in Odoo's prepayment wallet.**
  - Rejected for now: it is a custom, barely used module whose behaviour we can't see, and Finance
    would need to agree.

## Design

### Dealer: Pay PFI popup

The header and the amount-due box stay as they are. "Amount due" becomes **Balance to pay**: PFI total
minus confirmed payments minus payments waiting for confirmation. Under it is a small line,
"Paid so far KES X · Waiting for confirmation KES Y", shown when either is non-zero.

```
Choose payment method
[ M-PESA ]  [ Manual payment ]  [ Bank transfer   Coming soon ]   ← greyed, not clickable
```

**M-PESA tab.** It has two parts:

1. **Pay with a prompt on your phone** (layout only)
   - Fields: phone `07XX XXX XXX`, and an amount defaulting to min(balance, 500,000).
   - The button "Send payment prompt" is disabled, with the note "M-PESA prompts are being set up. For
     now, pay to the paybill and enter the M-PESA code below."
   - The fields validate as you type: Safaricom number, and 1 ≤ amount ≤ min(balance, 500,000).
2. **Already paid by M-PESA?**
   - The dealer enters the M-PESA code (10 characters) and presses **Check code**.
   - The portal looks the code up in Odoo (read only) and shows "Found: KES 120,000 paid 19 Nov 14:02".
   - Then **Submit payment**.
   - If the code isn't found: "We can't find this M-PESA payment yet. It can take a few minutes to
     reach us. Check the code or try again shortly." Nothing is saved.
   - If the amount found is bigger than the balance, it is refused with the same wording as an
     overpayment.
   - Paybill number and account wording come from Finance. Until then, the line shows the paybill
     from a setting, or is hidden if that setting is empty.

**Manual payment tab.**

> Once you have paid, enter the bank reference number here: [ ________ ] \*
>
> Choose which bank account you paid to: (•) KCB 1289725640  ( ) Equity 1080281394514 \*
>
> Amount paid: [ KES 7,362,144.00 ] \* (defaults to the balance; may be less, never more)

The current optional "Your bank" list is dropped (my call: it isn't in Adrian's list and Odoo doesn't
use it). The PFI number stays shown as the suggested reference to put on the transfer.

**Submit.** "Submit payment" sends the payment.
- On success the popup shows: "Payment sent to Trinity for confirmation. You'll see it as confirmed
  once checked."
- While the balance is still above zero, the Pay button stays on the order. It reads **Pay balance**
  after the first payment.

**Mockups** are drawn for laptop, tablet and phone before building, as for Analytics. They cover:
- the popup in each method;
- the staff payments card;
- the Needs Action row;
- the dealer's part-paid order.

### Dealer: order page and tracker

- The order page gains a **Payments** list showing each payment's date, method, reference, amount and
  status: "Waiting for Trinity", "Confirmed" or "Flagged: <staff note>".
- Tracker step 3 (Payment) shows "Part paid: KES X of Y" while confirmed payments are greater than 0
  but less than the total.

### Order states with part payments

These are the existing statuses; no new enum value is added.

| Event | Order goes to |
|---|---|
| Dealer submits a payment (from AWAITING_PAYMENT, PAYMENT_EXCEPTION) | PAYMENT_SUBMITTED → PAYMENT_VERIFICATION, as today |
| Dealer submits another payment while already in PAYMENT_VERIFICATION | stays PAYMENT_VERIFICATION; the record is just added |
| Staff confirm one payment, and confirmed total ≥ PFI total | PAYMENT_CONFIRMED |
| Staff confirm one payment, the total is still short, and other payments are still waiting | stays PAYMENT_VERIFICATION |
| Staff confirm one payment, the total is still short, and none are waiting | **AWAITING_PAYMENT** (new transition PAYMENT_VERIFICATION → AWAITING_PAYMENT; "Part paid") |
| Staff flag one payment, and others are still waiting | stays PAYMENT_VERIFICATION |
| Staff flag one payment, and none are waiting | PAYMENT_EXCEPTION, as today |

- **Payable statuses:** AWAITING_PAYMENT, PAYMENT_EXCEPTION and PAYMENT_VERIFICATION.
- **Balance rule.** The portal refuses an amount bigger than: PFI total − confirmed − waiting. This is
  checked on the server inside the same transaction that saves the payment.
- **Duplicates.** The portal refuses the same reference twice, across all orders:
  - a manual bank reference, compared case- and space-insensitive, per Trinity account;
  - an M-PESA code. This uses a unique index.
  - Flagged (REJECTED) payments don't count, so a dealer can resend a corrected payment with the
    same reference (my call).
- **Concurrency.** Confirming checks the payment is still waiting, like the existing stale-transition
  guard. Two staff pressing Confirm at once cannot post twice.

### Odoo payment draft (manual payments only)

Created right after the dealer's payment is saved; it is not part of the dealer's transaction.

| Odoo field | Value |
|---|---|
| `is_internal_transfer` | `false` |
| `payment_type` | `inbound` (Receive) |
| `partner_type` | `customer` |
| `partner_id` | same customer as the order's quotation: station's Odoo partner, else the dealer organisation's (reuse `resolvePartnerId`) |
| `amount` | the payment amount |
| `currency_id` | 92 (KES) |
| `date` | today, Nairobi |
| `ref` | the dealer's bank reference |
| `journal_id` | from the chosen account (table above) |
| `payment_method_line_id` | Manual line of that journal (table above) |
| `partner_bank_id` | company bank account of that journal (table above) |

- The Odoo ids for each account live next to the account in `PFI_BANK_ACCOUNTS`
  (`src/lib/company/pfi-settings.ts`). There's one list for the PFI, the popup and Odoo.
- **Idempotency.** Before creating, search for a `draft` payment with the same partner, journal, amount
  and ref. Reuse it if found, so a retry after a crash never makes a second draft.
- **On success:** store `odooPaymentId` and `odooState = "draft"`.
- **On failure:**
  - Store `odooError` (Odoo's message, trimmed).
  - The dealer still sees "sent for confirmation".
  - Staff see the error and a **Retry Odoo** button on that payment.

### Staff: Needs Action and the order page

- **Needs Action (staff Home).** The existing "Payment Confirmation" task changes:
  - It shows **one row per order** with waiting payments, newest first, up to 5:
    "DO-2026-000009 · MEMISI SUPPLIERS LTD · KES 120,000 by M-PESA", with a **Review →** button
    linking to `/intelligence/retail/orders/<id>`.
  - "View all" still opens the Checking payment stage.
- **Order page: Confirm Payment card.**
  - Each waiting payment gets its own block showing:
    - amount;
    - method;
    - account or M-PESA code;
    - reference;
    - Odoo status: "Draft in Odoo P…", "Not in Odoo yet: <error>" with Retry, or "Already posted in
      Odoo (M-PESA)";
    - a "does not match PFI" note only when it would overpay.
  - The block has its own **Confirm payment** and **Flag** buttons, which send `paymentId`.
- **Confirm, manual payment:**
  - If there is no draft yet, create it.
  - Then `action_post`, then read back the state.
  - If the state is `posted`, the payment is CONFIRMED and the order moves per the table.
  - If the state is anything else, or there is an error, the payment stays waiting and the error is
    shown. Nothing is confirmed in the portal that isn't posted in Odoo.
- **Confirm, M-PESA code:** no Odoo write. Re-read the Odoo payment; it must still be `posted` with the
  same amount. Then the payment is CONFIRMED.
- **Flag:** the payment is REJECTED with the staff note. For a manual payment with a draft, call
  `action_cancel` on the draft. If the cancel fails, the flag still stands and the error is logged and
  shown ("Cancel the draft in Odoo by hand").
- **Payment Summary** (staff order page) already shows Paid / Due from confirmed payments. It is
  unchanged apart from the per-payment list.

### Data changes (one additive migration)

The migration adds fields to `PaymentRecord`:
- `method`: enum `PaymentMethod { MANUAL, MPESA_CODE, MPESA_PROMPT }`. Existing rows are MANUAL.
- `bankAccountNumber String?`: the Trinity account chosen. Its Odoo ids come from settings, not the DB.
- `mpesaCode String? @unique`
- `odooPaymentId Int?`, `odooState String?`, `odooError String?`
- `reviewNote String?`, `reviewedById String?`, `reviewedAt DateTime?`

The state machine gains PAYMENT_VERIFICATION → AWAITING_PAYMENT.

### Odoo client

`OdooClient` gains four methods:

```ts
createPaymentDraft(input: PaymentDraftInput): Promise<{ id: number; state: string }>;
postPayment(id: number): Promise<{ state: string }>;
cancelPayment(id: number): Promise<{ state: string }>;
findMpesaPayment(code: string): Promise<{ id: number; amount: string; date: string; state: string } | null>;
```

- **Mock client:**
  - Drafts get fake ids and post to `posted`.
  - `findMpesaPayment` answers from a fixed test table, for example code `TEST000001` → 1,000.
  - Mock ids and codes are clearly fake.
- **Live client:**
  - `execute(account.payment, create | action_post | action_cancel | search_read)`.
  - `findMpesaPayment` searches journal 11, `state = posted`, with `ref` ending in `" - " + code`.
- **Kill switch.** New env flag `ODOO_PAYMENTS_LIVE` (default off). While it is off:
  - no Odoo payment is created, posted or cancelled;
  - manual payments show "Odoo payments are off: Accounts records this in Odoo";
  - **Confirm works portal-only, exactly as today** (my call: going live must not stop staff
    confirming payments before the Odoo test is approved).
- With the flag on, the full Odoo flow above applies.
- `findMpesaPayment` is a read, so it works whenever Odoo is live, whatever the flag says.

### Testing

- **Unit tests:**
  - balance and status rules (table above);
  - M-PESA code and phone validation;
  - the 500,000 cap;
  - account → Odoo ids mapping;
  - the live client's `account.payment` payloads, checked against a fake `rpc` with no network;
  - `ref` matching for M-PESA codes;
  - the kill switch refuses writes.
- **DB tests (tri_test):**
  - submit part payments;
  - confirm one → AWAITING_PAYMENT;
  - confirm the last → PAYMENT_CONFIRMED;
  - flag → PAYMENT_EXCEPTION;
  - overpay refused;
  - duplicate reference or code refused;
  - Odoo failure leaves `odooError` and Retry works;
  - double Confirm posts once.
- **Browser:** the popup on laptop, tablet and phone in Chromium, Firefox and WebKit, the same tooling
  as Analytics.
- **No live Odoo writes.** A live test plan (one small draft, post, then Finance reverses) goes to
  Adrian for approval separately.

### Rollout

- Migration on staging, then production (Adrian), before the deploy.
- `ODOO_PAYMENTS_LIVE` stays off in production until the approved live test passes. Until then:
  - payment confirmation works as it does today;
  - Accounts keep entering bank payments in Odoo by hand.
- **Finance must tell Accounts** to stop typing portal payments into Odoo by hand once the switch is
  on, or every payment is entered twice. Odoo's duplicate-reference check should catch most of these.

## Finance questions (not blocking the build)

1. M-PESA limit: KES 500,000 per payment (Adrian, 19 Nov). Paybill number and account wording: Adrian will supply.
2. What are the paybill number and the account-number wording dealers should use?
3. Should M-PESA payments claimed in the portal be moved in Odoo to the dealer's customer record?
   Today almost all sit on one walk-in customer.
4. Is journal 23 (not 12) the right KCB journal?
5. Approve the live test plan: one small draft, post, then reverse.

## Left to the builder

- Component split inside the popup.
- Exact copy for errors, following the wording above.
- Where `MPESA_MAX_PER_PAYMENT` and the paybill setting live (next to `PFI_BANK_ACCOUNTS`).
- Activity log entries for retry, confirm and flag, following existing `logActivity` use.
