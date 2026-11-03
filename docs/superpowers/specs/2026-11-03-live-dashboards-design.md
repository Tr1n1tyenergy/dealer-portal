# Live dashboards: staff Analytics, staff Home, dealer Home — design

**Status:** designs approved in the brainstorm (3 Nov 2026): Analytics direction C, the staff and dealer Home mockups, and the build sheet. Mockups: `.superpowers/brainstorm/2581-1793714229/content/` (`analytics-c.html`, `homes.html`, `build-scope.html`).
**Branch:** `feat/portal-redesign` (one branch for the whole redesign). This work goes in before the depot step (step 4).
**Out of scope:** new data entry, Odoo, the depot board, Note Taker and Presentations.

## 1. Why

The Home pages feel bland, and Analytics shows a few totals that don't say what is happening. Adrian asked for dashboards that are more visually appealing, live, and show what is actually in the portal. Home answers "what about me, today". Analytics answers "how is the business doing", with a live strip of what needs Trinity now.

## 2. Decisions (Adrian, 3 Nov)

- **Live updates:** push over the existing Pusher channel, plus a 1-minute refresh as a fallback, so the page stays current if Pusher is down or not configured.
- **Stuck limits per stage**, measured from when the order entered the stage:
  - Quotation / Odoo sync: 2 h.
  - PFI ready, not issued: 4 h.
  - Awaiting payment: 48 h.
  - Checking payment: 24 h.
  - Paid, not released: 8 h.
  - At depot (released, loading or loaded): 24 h.
  - On the road: 48 h.
- **Dealers see the truck registration and driver name** on their tracker.
- **Defaults:**
  - Active dealer: placed at least one order this month.
  - Gone quiet: no order in 30 days.
  - Dealer waiting for a reply: the last message in a dealer chat is from the dealer.
  - "Today" and all months use Nairobi time.
  - Value: the amounts on quoted orders, incl. 8% VAT.

## 3. Screens

### 3.1 Staff Analytics (`/intelligence/retail`, needs `analytics.view`)

Top to bottom, following the `analytics-c.html` mockup:
1. **Head:** title and a Live badge ("Updated just now"). It turns grey with "Updated hh:mm" when only the fallback refresh is running.
2. **Live strip:**
   - **Orders by stage:** 8 tiles (Submitted, Quotation, PFI ready, Awaiting payment, Checking payment, Paid, At depot, On the road), with the busiest tile in yellow. Each tile links to Orders on that stage.
   - **Stuck:** the 3 orders furthest over their limit, with how long they have waited, and "See all stuck orders", which opens a new **Stuck** tab on staff Orders (every order over its limit, oldest first).
   - **Happening now:** the latest 6 events.
3. **Four figures:** litres this month, value incl. VAT, orders, active dealers. Each has a 12-month line and its change against last month.
4. **Litres ordered**, 12 months (PMS, and PMS + AGO, as lines), with a table view.
5. **How long orders take:** the median this month for each of Order → PFI, PFI → paid, Paid → released and Released → delivered, with the slowest in yellow.
6. **By loading region:** Nairobi (Lake Oil), Nakuru, Eldoret and Kisumu, litres this month with a tick for last month. **Top dealers:** top 5 by litres this month. **Gone quiet:** dealers with no order in 30 days.

### 3.2 Staff Home (`/intelligence/dashboard`)

Following the staff half of `homes.html`:
- The photo greeting (as built).
- **Today in four numbers:**
  - new orders today, against yesterday;
  - payments confirmed today, with the amount;
  - litres dispatched today;
  - dealers waiting for a reply, with the longest wait.
- **Needs action** (as built, now with "waited" and a red chip past the stuck limit).
- **Happening now** (the same feed).
- **EPRA price list** days left; **Depots today** (loading and dispatched per depot today); **This month**.
- Permissions stay as now. Without `orders.view`, the page shows only the photo with "Ask an Admin for access" or "Your areas are in the menu above". "Dealers waiting" needs `messaging.view`.

### 3.3 Dealer Home (`/dealer/dashboard`)

Following the dealer half of `homes.html`:
- The photo greeting (as built).
- **Three raised cards:**
  - **To pay:** the total of PFIs waiting, how long the oldest has waited, and Pay PFI.
  - **On the way:** the order furthest along on its way, its step, and a Live badge.
  - **This month:** litres, orders, value, and the PMS/AGO split.
- **Where it is now:** the 7-step tracker for that order, with the current step pulsing, and the depot, truck and driver. With several orders on the way it shows "+ N more on the way", linking to Orders, Deliveries.
- **Fuel ordered** (as built), and **Today's prices** for the station's region, with the cost of 10,000 L PMS incl. VAT, using the PFI sums.
- **Orders:** the latest 3. **Messages:** the latest 2 from Trinity, with an unread count.
- The dealer only ever sees their own organisation's data.

## 4. How it works

- **Data:** each screen's numbers come from small pure functions in `src/lib/insights/`: stage counts, stuck, events, cycle times, regions, today, to-pay, on-the-way. Each takes plain rows and `now`. The pages fetch the rows with Prisma, one query per block, bounded by date: 12 months at most, with events and stuck limited by `take`.
- **Live:**
  - After every order transition (`service.ts`, the same place `OrderStatusHistory` is written), the server triggers a best-effort Pusher event. Staff get `order-changed` on `private-orders-staff`; the order's dealer gets it on `private-orders-dealer-{organisationId}`. The event carries `{ orderId, status }` only, never money or names.
  - The Pusher auth route allows `private-orders-staff` only for staff with `orders.view`, and `private-orders-dealer-{id}` only for that organisation's dealers.
  - A client `LiveRefresh` component on each dashboard subscribes and calls `router.refresh()`, at most once every 5 s, so the server-rendered page re-renders with fresh data. It also refreshes every 60 s when the page is visible. When it isn't connected, the badge shows the last update time.
  - A failed Pusher call never fails the order change, the same rule as Messages.
- **Events feed:** built from `OrderStatusHistory` (and new messages for staff). It is worded per status, e.g. "Pery Growers submitted payment for DO-2026-000014", with the time since, and the amount where it applies.
- **Charts:** plain SVG drawn at the measured width (`useWidth`), so text stays 13px or more. Every chart has a table view, and the colours follow the dataviz rules: blue PMS, teal AGO, yellow only for "slowest" or "busiest".

## 5. Testing

- **Unit tests first** for every `src/lib/insights` function:
  - stuck limits, each stage at and just over its limit;
  - median cycle times, including steps with no data;
  - Nairobi "today" and month edges;
  - the to-pay total, which reuses `sumKes`;
  - which order is "on the way";
  - the event wording for every status;
  - region mapping.
- **DB tests:** the Pusher auth for the two new channels. Staff without `orders.view` and other dealers are refused.
- **Browser checks** on the stress build:
  - all three pages at 1024, 1280, 1440, 768 and 390, with no sideways scroll, text 13px or more, and one `h1`;
  - a live check: change an order's status in `tri_stress` through the service, and the open page updates within 70 s with Pusher off, or within 10 s with it on;
  - view-only and no-access roles see no action buttons.
- **A final whole-branch review** for this part.

## 6. Acceptance

- Every number traces to portal data; nothing is invented. Empty states read plainly, e.g. "No orders yet" or "Nothing stuck right now".
- Pages update without a reload.
- No dealer can see another dealer's data, and no staff member sees a block their permissions don't allow.
- Phone layouts stack as in the mockups, with stage tiles scrolling sideways.
