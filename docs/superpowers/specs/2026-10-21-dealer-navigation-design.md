# Dealer navigation: every button does what it says

**Date:** 2026-10-21
**Portal side:** Dealer
**Status:** Draft for review

## Why

Dealers press buttons that do nothing, or that open something other than what the label says:
- **Sidebar:** PFIs & Documents, Payments and Deliveries all open the same order. Support goes to a section that doesn't exist. Account opens the Dashboard.
- **Top bar:** the search box, the bell (with a made-up "3") and the avatar menu do nothing.
- **Dashboard:** its links all go to the same place.

On 2026-10-21 Adrian chose to **"make it honest now, build the missing pages later"**. Every control either works or is removed. No fake numbers, no "coming soon" buttons.

## Out of scope

- A real notifications feed.
- A global search across documents.
- A Stations page or an Account/profile page.
- Downloadable quotation, payment-confirmation or delivery-note documents.
- Order summary download.

These come later, each with its own spec.

## Dependencies and branch

- Branch `feat/dealer-navigation`, started **after** the PFI PR (`feat/pfi-pdf`) and the tracker fix (`fix/order-progress-steps`) are merged.
- It needs the PFI PDF route (`/api/orders/[id]/pfi`), and it edits the same order page as the tracker fix.

## 1. My Orders becomes a real list

`/dealer/orders` stops redirecting to the newest order. It shows **all of the dealer's orders**, newest first, reusing the existing `RecentOrders` table component without the 8-row cap.

**Tabs** are set by `?view=` in the URL, so the sidebar and dashboard can link straight to a tab:

| Tab | `view` | Orders shown (statuses) |
|---|---|---|
| All | (none) | every order |
| Needs payment | `payment` | PFI_ISSUED, AWAITING_PAYMENT, PAYMENT_EXCEPTION |
| PFIs & Documents | `documents` | orders that have a PFI |
| Deliveries | `deliveries` | RELEASED_TO_DEPOT, LOADING, LOADED, DISPATCHED, IN_TRANSIT, DELIVERY_EXCEPTION, DELIVERED, CLOSED |

- The PFIs & Documents tab adds a **View PFI** link on each row, using `/api/orders/[id]/pfi`.
- The view-to-statuses mapping lives in one function, `dealerOrderView(view)` in `src/lib/orders/dealer-views.ts`. It returns the Prisma `where` fragment, and an unknown `view` falls back to All.
- The existing search and the Status/Station filters keep working on the full list.
- **Removed:**
  - the disabled "Last 30 Days" select;
  - the ⋮ "More actions" button on rows. Each row already links to its order.
- Still works: `?submitted=<id>` after Place Order keeps redirecting to that order. The empty state ("You have not placed any orders yet") stays.

## 2. Sidebar

| Item | Goes to | Highlighted when |
|---|---|---|
| Dashboard | /dealer/dashboard | on the dashboard |
| Place Order | /dealer/orders/new | on Place Order |
| My Orders | /dealer/orders | on the list with no `view`, or on any single order |
| Messaging | /dealer/messaging | in messaging |
| PFIs & Documents | /dealer/orders?view=documents | that tab |
| Payments | /dealer/orders?view=payment | that tab |
| Deliveries | /dealer/orders?view=deliveries | that tab |
| Stations | /dealer/dashboard#stations | never; it scrolls to the dashboard's stations card |
| Support | opens the Support card (section 4) | never |

- **Account** leaves the sidebar and moves into the avatar menu (section 3).
- Highlighting is decided by one function, `activeDealerNav(pathname, view)`, which is unit tested.

## 3. Top bar

- **Search:** typing an order reference (e.g. `DO-2026-000003`) and pressing Enter opens `/dealer/orders?q=<text>`, the list filtered by that text. The placeholder becomes **"Search orders…"**.
- **⌘K / Ctrl+K** focuses this search box.
- **Bell:** shows the dealer's **real unread message count** and links to `/dealer/messaging`. With nothing unread there is no badge. The count comes from one query on the dealer's unread message receipts, using the messaging visibility rule, so hidden dealer-to-dealer chats don't count.
- **Avatar menu** (click to open; Escape or a click outside closes it):
  - the dealer's name and email;
  - **Change password**: opens the existing reset flow (`/intelligence/forgot-password`), which emails a reset link;
  - **Sign out**.

  The separate sign-out icon stays.

## 4. Support

The sidebar's **Support** item, and Place Order's "Need help?" link, open a small **Support card**: a modal with Trinity's email and phone numbers, taken from `PFI_COMPANY` in `src/lib/company/pfi-settings.ts`. The email is a `mailto:` link and each phone number a `tel:` link. Nothing else.

## 5. Dashboard

- **Hero and Quick Actions:** "View all orders", "View quotations", "View payments", "View PFIs", "Make a Payment", "Track deliveries" and "View delivered" each link to the matching tab in section 1.
- **"View stations →":** removed. It pointed at its own card.
- **Station rows:** the arrow icon is removed, since they are information, not links.
- **Recent Orders:** "View all orders →" opens `/dealer/orders`, which is now a real list.

## 6. Order page

- **Previous / Next:** Previous opens the **older** order and Next the **newer** one.
- **Breadcrumb:** "My Orders" becomes a link to `/dealer/orders`.
- **Order Documents rows:**
  - the **PFI** row opens the PFI PDF (already a link after the PFI PR);
  - Sales Quotation, Payment Confirmation and Delivery Note have no document yet, so they lose their arrow and are not clickable. Their status badges (Ready / Pending) stay.
- **"Download Summary":** removed until there is a summary to download.
- **"⌘K" hint** in "Find another order": now works, focusing that search box. It doesn't conflict with the top bar, because on the order page ⌘K focuses the order search.

## 7. Messaging (dealer side)

- **"View Profile":** removed for dealers, because dealers have no profile page to open.
- **"View all →"** under Shared Files and under Recent Orders: goes to `/dealer/orders?view=documents` and `/dealer/orders` respectively.

## Testing

**Unit tests:**
- `dealerOrderView`: each view returns the right statuses, and an unknown view falls back to All.
- `activeDealerNav`: every row of the sidebar table, plus a single order counting as My Orders.
- Previous/Next ordering: a small pure helper that gives older and newer neighbours.

**DB test:**
- The unread count for a dealer: messages from staff count; messages in a hidden dealer-to-dealer chat and the dealer's own messages don't.

**Live check** (throwaway database, isolated copy): as a dealer with orders in different stages,
- every sidebar item opens its page and highlights correctly;
- every tab shows the right orders;
- search by reference works;
- the bell shows the real count;
- the avatar menu and the Support card open and close;
- Previous/Next go the right way;
- the PFI row opens the PDF.

**Final sweep:** no `<button>` in the dealer portal without a handler, a submit role or a link.
