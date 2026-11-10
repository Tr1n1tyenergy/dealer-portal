# Portal redesign (dealer, staff, depot) — design

**Status:** approved in conversation, section by section (2 Nov 2026). Written spec awaiting review.
**Scope:** how the three portals look and how their navigation is organised. Behaviour, data and permissions do not change, except the small items listed under "Fixed along the way".
**Out of scope:** Note Taker and Presentations (parked until management decides), new features (catalogue, maintenance, Odoo prices), the Odoo integration.

## 1. Why

Today the three portals look like three products: the dealer portal has a navy sidebar and a photo header, the staff portal is fully dark, the depot page has no logo or menu. The font is Inter, not Trinity's Century Gothic. On phones the dealer dashboard opens with five tall number cards and a header that wraps over four lines; a status column is cut off ("Awaiting Payme…"); "Place order" appears three times on one screen; small all-caps labels are everywhere; the staff header shows a made-up "12" and a search box that does nothing.

Goal: one professional, light, on-brand system that works on phones, tablets and desktops, with every button working and nothing on screen that does not earn its place.

## 2. Chosen direction: "E2"

Picked from five dealer-dashboard options (three from the redesign skill, two from taste-skill v1), then three variants of E. Reference mockup: `.superpowers/brainstorm/184984-1793623930/content/e-variants.html` (option E2). Brand assets: `D:\Downloads\Dealer portal files\brand-2026-11-02\` (logo PNG, two station photos).

- White header bar: Trinity logo left; menu words in Trinity blue; on hover a yellow underline slides in under the word; the current page stays underlined.
- On home screens only: a full-width station photo, edge to edge (no fade), darkened from the bottom up so white text and buttons on its lower part stay readable while canopy and sky stay vivid.
- Light page ground, white surfaces, lists separated by space and thin lines rather than boxed cards.
- Yellow is reserved for the one main action on a screen.

Rejected for the record: taste-skill v2's "well-kept board" (giant station-name band, giant word headings, no gradient) — wrong for a working portal.

## 3. Foundation (design tokens and shared controls)

All values live as CSS custom properties in `src/app/globals.css`; every screen uses tokens, never its own colours or sizes.

**Colour**

| Token | Value | Use |
|---|---|---|
| brand blue | `#3853a4` | menu words, links, secondary emphasis |
| teal | `#2cc0d2` | gradient end, "on the way" status |
| brand gradient | `#3853a4` → `#2cc0d2`, left to right | progress bars and similar small brand moments only |
| yellow | `#ffca06` | the main action, the active-menu underline, station name on photos |
| ink | `#18213a` | text |
| soft ink | `#64708a` | secondary text only (running text stays in ink) |
| ground | `#f9fafb` | page background |
| surface | `#ffffff` | panels, header |
| line | `rgba(148,163,184,.3)` | thin separators |

Status chips (one meaning each, used everywhere): yellow = waiting on the dealer (awaiting payment, PFI ready); blue = Trinity is checking (payment verification); teal = on the way (released, loading, in transit); green = done (delivered); red = problem (exceptions, sync failed); grey = cancelled.

**Type**
- Font stack: `"Century Gothic"` (installed on Office PCs) → **TeX Gyre Adventor** (free, GUST licence, self-hosted in `public/fonts/`, near-identical geometric design) → `sans-serif`. No Monotype web licence; switching to a licensed web font later is one line.
- Four sizes only: page title, section title, body (16px minimum for running text), small (13px minimum). Tabular figures for all numbers and amounts. Sentence case everywhere; no small all-caps labels.

**Shape and controls** (one style each, with hover, pressed, keyboard focus and disabled states)
- Buttons: pill-shaped. Primary = yellow with ink text; secondary = outlined; quiet = text link. Destructive = outlined red.
- Menu links and tabs: brand-blue words, yellow underline that slides in (transform only, ~250ms), current one underlined.
- Inputs and selects: label above, helper text below, error text below in red; never pop-up alerts.
- Status chips as above. Panels and photos have rounded corners; lists are not wrapped in cards.

**States every list or panel provides**: loading (grey placeholder shapes in the layout's shape, no spinners), empty (one sentence and the next action), error (plain message with a retry).

**Motion**: only the underline slide, button press and small entrances; all switched off under `prefers-reduced-motion`.

## 4. Header and menu

One header component for all portals: white bar, logo left, menu words, right-hand area, account button (initials → "My account", "Sign out"). Staff links are shown only when the person's permissions allow them (`canUser`), so nobody sees a link they cannot open.

| Portal | Menu | Right side |
|---|---|---|
| Dealer | Dashboard · Orders · PFIs · Messages · Support | order-number search, message bell, yellow "Place an order", account |
| Staff | Home · Orders · Analytics · Messages · Users · Admin ▾ (Admin users, Activity log, Settings) | message bell, account |
| Depot | Loading board | account (Sign out) |

- The dealer menu goes from nine entries to five: "Place Order" becomes the yellow button; "Payments", "Deliveries" and "Stations" become tabs or panels inside Orders and the dashboard.
- The staff header loses the made-up "12" badge and the dead "Search anything" box; the bell shows the real unread-message count.
- Tablet: same bar; words that do not fit fold into "More ▾".
- Phone: logo + a "Menu" button opening a full-screen list of the same links (dealers get "Place an order" at its top). No icon-only navigation.

## 5. Home screens (the only screens with the photo)

**Dealer dashboard (E2).**
- Photo header: station name in yellow (for dealers with several stations: company name and "N stations"), "Good afternoon, *company*" (Nairobi time), one sentence built from real data — what needs them plus today's PMS and AGO prices for their region — e.g. "One PFI is waiting for payment and one delivery is on the road."
- Buttons: "Place an order" always; a second button chosen by the situation: "Pay PFI" if a PFI awaits payment, else "Track delivery" if an order is on the way, else none.
- Below: the latest five orders as a list (number, fuel, amount, status chip; each row opens the order) and a "This month" panel (litres, PMS/AGO split as a gradient bar, number of orders).
- No orders yet: "No orders yet. Place your first order and we'll prepare the quotation and PFI for you."

**Staff home** (replaces the tile launcher, now redundant with the header).
- Photo header: "Good afternoon, *name*" and one sentence of what waits on Trinity, e.g. "3 payments to check, 2 orders to release, 1 order stuck at Odoo"; buttons open the matching filtered Orders list.
- Below: "Needs action" (orders waiting on staff with the right button per row) and "This month" (orders, litres, value). Only what the person's permissions allow; a Staff Member with no access sees "Ask an Admin for access".

**Depot home** (the loading board with a header).
- Photo header (tanker photo already in the repo) with the depot name and e.g. "2 orders to load · 1 ready to dispatch".
- Below: the four queues as today (ready to load, loading, ready to dispatch, on the road) as clean lists with their action buttons; empty queue: "Nothing to load right now."

## 6. Working pages

Pattern: header → page title + one-line description + the page's main action on the right → content in a centred column (max ~1,280px). Tabs scroll sideways on phones instead of wrapping. Lists: sentence-case column names, status chips, row opens detail, row actions use the shared button styles. On phones each row becomes a stacked item (number, details, status, buttons); no sideways-scrolling tables.

| Page | Changes |
|---|---|
| Staff Orders | Tabs in one row; search covers all stages; quotation numbers don't wrap; Confirm payment = primary, Flag exception = outlined red, Release to depot = primary with the depot picker |
| Dealer order page | 7-step tracker, documents (PFI) and payment form in the new style |
| Place order | Same three steps; AGO starts at 0; amount including VAT updates as quantities change |
| Messages | List and conversation side by side on desktop, one at a time on phones |
| Users and Admin | Clean list; buttons only for actions the person may take; Permissions window restyled |
| Analytics | Invented trend lines removed; charts in brand colours; real numbers only |
| Login, activation, reset password | One shared design with the station photo (fixes the missing image) |
| New: "Page not found" and error page | Branded, with a way back home |

Note Taker and Presentations stay hidden and are not restyled.

## 7. Fixed along the way

From the 2 Nov audit: (1) broken activation image; (2) Orders search only in the Pending tab; (3) AGO pre-filled at 10,000 L; (4) made-up numbers on staff screens (audit fix 14). From the permissions minors: view-only users no longer see create/delete/invite buttons; the Permissions button no longer shows on Admin rows for non-Admins. Items 1 and 2 are also done now as quick separate fixes for the trial; the redesign carries them over.

## 8. Rollout

Four steps, all on one branch (`feat/portal-redesign`) and one pull request, pushed only when all four are built (Adrian, 3 Nov):

1. **Foundation** — tokens, fonts, shared controls, the header for all portals, login/activation/reset pages, "Page not found" (≈1 day).
2. **Dealer portal** — dashboard, Orders, order page, Place order, PFIs, Messages, Support (2–3 days).
3. **Staff portal** — home, Orders, Users and Admin, Permissions window, Analytics, Messages; dark to light (≈2 days).
4. **Depot** — loading-board home with header (½ day).

Rules for every step:
- Behaviour unchanged; every existing unit and DB test stays green.
- New logic is test-first: the "what needs you" sentence, the second-button choice, the staff "Needs action" list and counts, which menu links each person sees.
- Old CSS is deleted as each page moves over (no two designs side by side).
- Before/after screenshots of every changed page at 1440, 768 and 390 px using the Playwright scripts from the 2 Nov stress test; Adrian checks in a browser after each step and before the push.
- Accessibility: text contrast on the photo (WCAG AA), visible keyboard focus, reduced motion.
- UI work follows the taste-family skill for apps (redesign-skill), with the brand gradient kept.

## 9. Acceptance

- All portal pages use the tokens and the shared header; no page has its own colour values.
- Century Gothic shows on PCs that have it; TeX Gyre Adventor elsewhere; no Inter left.
- No horizontal scrolling at 390 px on any page; no text cut off.
- Every button and link does something or is visibly disabled; no made-up numbers anywhere.
- Status chips use the one colour per meaning listed in §3.
- Existing test suites green; new tests for §8's logic.
