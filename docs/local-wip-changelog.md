# Local WIP changelog (unpushed)

**Purpose:** Document local codebase changes that are **not yet pushed** to GitHub (`Tr1n1tyenergy/dealer-portal`).  
**Workflow:** Update this file whenever we change local code. Keep everything on the same local feature commit until we explicitly push.

**Branch (intended):** `feature/dealer-side-hero-plus-users-page-rebuild` (prior WIP also lived on `feature/odoo-external-id-mapping`)  
**Do not push** until the team approves.

---

## How we maintain this

1. After each meaningful local change, add a dated entry below (files + why).
2. Stage the code **and** this changelog together.
3. Until the branch is pushed: **amend** into the single WIP commit (do not create a long chain of tiny commits unless asked).
4. After push/PR: close this WIP section and start a new one only if needed.

---

## Current WIP bundle — Odoo External ID live quotation mapping

**Started:** 2026-10-08 (after production security hardening was already on `main`)  
**Status:** Local only — not on `origin`

### Goal

Move portal → Odoo quotation create from numeric/hardcoded IDs to **Odoo External IDs**, with live JSON-RPC resolving them via `ir.model.data` at call time. Scope is quotation create (PFI/payment/depot remain later).

### Files in this bundle

| Path | Role |
|------|------|
| `src/lib/integrations/odoo/external-ids.ts` | Parse `module.name` External IDs |
| `src/lib/integrations/odoo/external-ids.test.ts` | Unit tests for parser |
| `src/lib/integrations/odoo/quotation-contract.ts` | Warehouse + station + source-location External ID maps |
| `src/lib/integrations/odoo/live-client.ts` | Resolve External IDs; template→variant; quant→location |
| `src/lib/integrations/odoo/fuel-products.json` | Product candidates; confirmed PMSL001 / AGOL001 |
| `src/lib/integrations/odoo/fuel-products.ts` | Candidate helpers + env overrides |
| `src/lib/integrations/odoo/config.ts` | `ir.model.data`, stock warehouse/location/quant models |
| `.env.example` | Document External ID env overrides (placeholders only) |
| `.gitignore` | Keep secret env files ignored (without ignoring `.env.example`) |
| `docs/local-wip-changelog.md` | This file |
| `scripts/bootstrap-production-dealer.ts` | Gated production DEALER_ADMIN bootstrap |
| `scripts/run-with-production-env.ts` | Allows admin + dealer bootstrap scripts |
| `package.json` | `production:bootstrap:dealer` script |
| `src/components/messaging/*` | TRI Messaging glassy 3-column staff UI |
| `src/app/intelligence/retail/retail-messaging.css` | Staff messaging page hero shell |
| `src/app/dealer/dealer-messaging.css` | Dealer messaging light shell + forecourt hero |
| `src/app/dealer/dealer-support.css` | Dealer Support Centre shell + My Tickets UI |
| `src/lib/support/*` | Ticket service, storage, constants, FAQ data |
| `prisma/migrations/20261107100000_support_tickets/` | Support ticket tables |
| `src/app/dealer/dealer-stock-reporting.css` | Stock Sale Reporting dashboard shell |
| `src/components/dealer/stock-reporting-*.tsx` | SSR dashboard, module shell, waves, stage stubs |
| `src/lib/stock-reporting/*` | Report progress, service, actions, formatting |
| `prisma/migrations/20261109120000_stock_sale_reports/` | StockSaleReport + station pump/tank counts |
| `src/app/dealer/(portal)/stock-reporting/**` | SSR routes (dashboard, records, rtt, stages; history/downloads redirect) |
| `src/lib/stock-reporting/rtt.ts` | RTT create/list/aggregate/correct + draft sync |
| `src/components/dealer/rtt-calibration-page.tsx` | RTT & Truck Calibration UI |
| `prisma/migrations/20261109190000_station_pump_rtt_events/` | `StationPumpRttEvent` + `meterInitialized` |
| `src/components/dealer/wet-stock-form.tsx` | Step 3 wet stock reconciliation UI |
| `src/lib/stock-reporting/wet.ts` / `wet-calc.ts` | Wet save/complete + signed variance engine |
| `prisma/migrations/20261109160000_wet_stock_reconciliation/` | Wet state/resolution + `StockSaleWetAudit` |
| `src/components/dealer/monetary-form.tsx` | Step 4 monetary reconciliation + close shift |
| `src/lib/stock-reporting/monetary.ts` / `monetary-calc.ts` | Expected revenue, collections, close validation |
| `prisma/migrations/20261109170000_stock_sale_monetary/` | Monetary fields + `StockSaleMonetaryAudit` |
| `src/components/dealer/stock-report-submitted.tsx` | Submitted confirmation UI |
| `src/lib/stock-reporting/reference.ts` / `report-pdf.ts` | Report reference + PDF |
| `prisma/migrations/20261109180000_stock_sale_report_reference/` | `reportReference` + equipment snapshot |
| `src/app/api/support/**` | Dealer + staff support APIs |
| `src/app/api/messaging/conversations/[id]/context/route.ts` | Peer + orders + files context |
| `src/app/api/messaging/files/**` | Authorized order/PFI file download |
| `src/styles/responsive-tokens.css` | Site-wide `--tri-*` fluid type/space/gutter/hero caps |
| `.cursor/rules/responsive-tokens.mdc` | Discipline: new UI consumes shared tokens |
| `src/app/intelligence/retail/(home)/users/page.tsx` | Users Management under Staff Portal shell |
| `src/components/retail/retail-users-client.tsx` | Premium Users page (invites, tabs, roles) |
| `src/app/intelligence/retail/retail-users.css` | Light Users design system |
| `src/components/retail/station-multi-select.tsx` | Searchable multi-station invite dropdown |
| `src/components/retail/create-role-modal.tsx` | Create Role modal |
| `src/lib/users/staff-role-templates.ts` | Role catalog + template CRUD |
| `src/lib/users/system-role-defaults.ts` | System role matrix in SystemSetting + user override apply |
| `src/lib/permissions/app-modules.ts` | Five app-module → tab registry |
| `src/components/retail/role-permissions-panel.tsx` | Module selector + access switch + tab matrix |
| `src/app/api/retail/roles/**` | Roles API |
| `prisma/migrations/20261112120000_staff_role_templates/` | `StaffRoleTemplate` table |
| `src/components/dealer/dealer-hero-media.tsx` | Legacy no-op (plate is CSS) |
| `src/app/dealer/dealer-portal-hero.css` | Dealer hero plate = staff pin-point copy |

### Mapping captured

**Warehouses (`stock.warehouse` External IDs)**

- LAKE OIL GROUP (NBI) → `__export__.stock_warehouse_138_2263a4fc`
- KPC ELDORET → `__export__.stock_warehouse_141_2be39467`
- KPC NAKURU → `__export__.stock_warehouse_143_2ab4577e`
- KPC KISUMU → `__export__.stock_warehouse_144_1efecfce`

**Stations with External IDs (`account.analytic.account`)**

- Banana, Kambiti, Kiserian, Kitanga, Malaa*, Mariakani*, Migori, Mumias, Nakuru Town, Eldoret Outspan, Sobea  
\*In fulfillment map; not fully wired in dealer registry yet.

**Still missing station External IDs:** Kitale, Ol'Joro-Orok, Greensted, Kisii, Meru-Gaitu, Athiriver, Rimpa, Kabati Kitui, Thome, Maili Tatu, Magumu, Maua Town, Dagoretti.

**Products (confirmed 2026-10-09)**

- PMS → PMSL001 `__export__.product_template_56638_95395aa6`
- AGO → AGOL001 `__export__.product_template_56635_9d243ec3`  
Other product.template candidates kept for reference only.

**Source locations**

- Candidates are `stock.quant` External IDs (not `stock.location`).
- Live client resolves quant → `location_id`.
- Active default per warehouse: PMS LOCAL quant where available.
- Env overrides: `ODOO_SOURCE_LOCATION_*_EXTERNAL_ID`.

### Runtime behaviour notes

- Quotation create still writes `sale.order` fields: partner, sale_type, lines, warehouse, source_location, station_id when known.
- Temporary EPRA unit prices still applied until station pricelists own pricing.
- Dealer order gates (`TRI_LAUNCH_MODE` / mock-in-production) unchanged by this WIP.

### Explicitly out of scope (this WIP)

- PFI PDF download
- Payment / depot / Odoo sync after quotation
- Production push, Vercel deploy, Neon migrations

---

## Entry log

### 2026-11-13 — Dealer hero copy sits lower + nowrap removed
- Reduced dealer hero bottom padding so the text block sits a little lower (closer to overlapping cards) on every dealer page.
- Dashboard hero `h1` no longer `white-space: nowrap` (long org names looked oversized on wide production screens).
- Note: hero type reduction/alignment ships in `main` (#70 via `dealer-portal-hero.css`); if production still shows the old large type, redeploy / hard-refresh — local already matches `origin/main`.

### 2026-11-13 — Hero text block type bump (staff → dealer)
- Staff hero copy nudged up slightly (eyebrow ~0.875rem, title `clamp(1.85rem, 2.85vw, 2.55rem)`, sub ~1.12rem) in `staff-portal-hero.css`.
- Dealer `dealer-portal-hero.css` locked to the same final sizes on every portal page.

### 2026-11-13 — Restore Inter (drop Century Gothic)
- Site-wide font back to **Inter** (Google Fonts link in root layout + `--font-sans` / portal stacks). Removed `century-gothic.css` import; Adventor/@font-face no longer used.

### 2026-11-13 — Remove dealer header search
- Dropped the topbar “Search orders…” input from `DealerShell` (page-level order search / shortcut still available where present).

### 2026-11-13 — Dealer hero = staff pin-point plate
- Copied staff `staff-portal-hero.css` plate onto every dealer portal page: same asset (`trinitynrg-forecourt-at-sunset.png?v=5`), cover @ `42% 30%`, left haze gradient, `--tri-hero-height-capped`, padding, gold bar copy.
- New `src/app/dealer/dealer-portal-hero.css`; imported from portal layout + each page CSS entry so it wins over legacy per-page crops.
- Removed divergent dealer img/veil crops (`DealerHeroMedia` now no-op / hidden).

### 2026-11-13 — Staff home accents: blue/yellow only
- KPI/panel/card top highlights + matching icons use Trinity blue or yellow only (no purple/slate/amber accents).

### 2026-11-13 — Staff account menu above hero
- Header overflow visible + higher z-index so Sign out dropdown isn’t clipped behind the hero.

### 2026-11-13 — Orders preview meta type smaller
- Order Tracking preview detail lines (dealer/station/date/products/value) stepped down to `--tri-font-sm`.

### 2026-11-13 — Staff header: name + account menu like dealer
- Keep First Name Last Name visible beside avatar (was hidden under 1500px); Sign out / Change password menu on chevron.

### 2026-11-13 — Century Gothic actually loads in-browser
- Self-hosted TeX Gyre Adventor OTFs as `@font-face "Century Gothic"` (`public/fonts/century-gothic/`, `src/styles/century-gothic.css`) so the face renders even when the proprietary font isn’t installed.
- Prefer `local(Century Gothic)` when present; otherwise Adventor (GUST/OFL).

### 2026-11-13 — Staff heroes: copy nudged right
- Shared hero text block `margin-left` nudged right a little on every staff page.

### 2026-11-13 — Staff heroes: type bump (more than a tad)
- Shared hero eyebrow / title / sub stepped up again (`staff-portal-hero.css`).

### 2026-11-13 — System font → Lexend Deca
- Replaced Inter with **Lexend Deca** site-wide (Google Fonts variable `wght@100..900`, `--font-sans`, CSS stacks).

### 2026-11-13 — System font note + softer bold weights
- Softened bold one step everywhere in CSS: 700→650, 750→700, 800→750, 900→800; Tailwind `font-bold`/`extrabold`/`black` + `b`/`strong` match.

### 2026-11-13 — Staff heroes: slight type bump again
- Eyebrow / title / sub nudged up another small step in `staff-portal-hero.css`.

### 2026-11-13 — Staff heroes: lift copy + slight type bump
- Increased hero bottom padding so copy sits a bit higher above cards; eyebrow/title/sub nudged up one step.

### 2026-11-13 — Staff heroes: lower copy + Messages overlap
- Hero copy `align-items: flex-end` so text sits just above overlapping cards on all staff pages.
- Messages workspace: stronger negative margin (beats `.so-wrap`) so columns tuck into the hero like other tabs.

### 2026-11-13 — Staff heroes: slightly smaller type
- Shared `staff-portal-hero.css`: eyebrow / title / sub stepped down a notch on every staff page.

### 2026-11-13 — Payment Summary columns even width
- Amount Paid / Due / Order Total use equal `1fr` columns across the card.

### 2026-11-13 — Fluid laptop scale across staff UI
- Widened `--tri-root-font` (tighter on ~13–14" / short height; larger on 16"+ / 1800+).
- Staff Orders + portal shell/hero + remaining staff retail CSS: major type → `--tri-font-*`, chrome `px` → `rem`, card radius/gutters on `--tri-*` (no page zoom).
- Files: `responsive-tokens.css`, `staff-orders.css`, `staff-portal.css`, `staff-portal-hero.css`, `staff-home.css`, `staff-stock-reporting.css`, `retail-users.css`, `staff-support.css`, `retail-analytics.css`, `retail-messaging.css`, `retail-portal.css`, `retail-orders.css`.

### 2026-11-13 — Order Activity under Documents, base = Payment base
- Activity top sits under Documents; right column height matches left (Payment base); timeline scrolls inside.
- `StaffOrderDetailGrid` measures left column height onto the side column.

### 2026-11-13 — Documents: PFI title/issued stay one line
- Doc name + sub use nowrap/ellipsis so Pro Forma Invoice (PFI) and issued line don’t wrap taller.

### 2026-11-13 — Order detail cards: trim Order Details, roomy dealer rows
- Dropped dealer reference, notes, and line prices from Order Details.
- Dealer & Station rows get more vertical padding; both cards stretch to equal height.

### 2026-11-13 — Progress connectors: gap before circles
- Staff detail + shared rails leave a clear gap between connector lines and stage dots (premium look).

### 2026-11-13 — Order detail progress: larger + centered across width
- Detail rail nodes sit centered in equal columns with span lines; bigger dots/labels (fixes left bias).

### 2026-11-13 — Order detail top cards: compact equal row
- Harder compact pass: smaller progress nodes, denser heads, horizontal action rows (icon|copy|go).
- Both top cards stretch to the same short height; progress centered in the track card.

### 2026-11-13 — Order detail top cards: sleeker height
- Tracking + Staff Actions tighter heads/padding; progress rail vertically centered; compact action rows.

### 2026-11-13 — Order detail: Staff Actions height + mockup colors
- Tracking + Staff Actions share a stretched top row (equal height).
- Confirm Payment yellow/ready; Release to Depot locked gray with lock icon.

### 2026-11-13 — Order detail hero: shared plate, no hero CTAs
- Detail (+ list) use canonical `so-hero` crop/height; removed Back to Orders / Download PFI from hero.

### 2026-11-13 — Orders table viewport: 6 rows
- Table scroll area height shows six order rows (was four).

### 2026-11-13 — Tracker: drop Loading step system-wide
- Shared `DEALER_TRACKER_STEPS` is now 6 steps; RELEASED/LOADING/LOADED stay on Released to Depot until transit.
- Dealer dashboard/order headlines updated; staff + dealer rails inherit via `dealerTrackerSteps`.

### 2026-11-13 — Orders status tabs: drop PFI Issued & Exceptions
- Filter strip tabs are All / Awaiting / Checking / At Depot / In Transit / Completed only.

### 2026-11-13 — Orders tracking preview: meta type dialed back
- Preview detail lines slightly smaller (~0.95rem) with matching icon tiles.

### 2026-11-13 — Orders tracking preview: larger meta + View PFI blue
- Order detail lines ~1.5× type; premium icon tiles; meta grows to fill vertical space.
- View PFI: blue border/text; hover blue fill + white text.

### 2026-11-13 — Orders tracking preview: dealer-style rail + matched height
- Right Order Tracking card stretches with left workspace; more vertical padding; actions sit at bottom.
- Progress rail matches dealer dashboard (blue done / gold active / Done·Pending notes).
- Shared `trackerStepSecondary`; staff list + detail use same stage labels as dealer tracker.

### 2026-11-13 — Orders product badges side-by-side
- PMS/AGO pills stay on one row (no wrap) and are slightly smaller.

### 2026-11-13 — Orders table: padding, arrow-only actions, 4-row viewport
- Padded table shell; fixed height for 4 rows with internal scroll (empty space when fewer).
- Actions: eye removed; circular arrow only. Sticky thead inside scroll area.

### 2026-11-13 — Orders period dropdown above table
- Workspace card / filters no longer clip the period menu; raised stacking so it paints over the table header.

### 2026-11-13 — Orders filter widths/spacing
- Clearer gap after Reporting Period; slightly narrower Dealer + Search so period gets more room.

### 2026-11-13 — Orders reporting period: single-field custom range
- Period control: All time default, dark preset menu, Custom range shows `dd MMM yyyy – dd MMM yyyy` in the same field (no From/To inputs).
- Custom calendar: first click start (green), second click end (red); hidden `period`/`from`/`to` for Apply.
- File: `staff-orders-period-filter.tsx` + `staff-orders.css`.

### 2026-11-13 — Orders filters: drop Station, mockup spacing
- Toolbar is Reporting Period + Dealer + Search + Apply/Clear only; Station control removed.
- Wider gaps, calendar-prefixed period select, unlabeled search field (aria label kept).

### 2026-11-13 — Orders status tabs slightly taller/larger type
- Status filter pills: a bit more height and font size.

### 2026-11-13 — Orders KPI icons/text larger
- Bumped KPI icon tile, glyph, label, and value sizes for readability.

### 2026-11-13 — Orders KPI cards taller (~1.75×)
- Increased KPI card min-height/padding and icon size after icon-left layout.

### 2026-11-13 — Orders KPI cards: icon-left compact layout
- Stat cards: icon left, label + number stacked on the right (mockup), shorter vertical height.

### 2026-11-13 — Staff Orders page visual correction (Attachment 3)
- 7 KPI cards (Total, Awaiting Payment, Checking Payment, PFI Issued inclusive, At Depot, In Transit, Completed); removed EPRA banner from Orders list (home EPRA card retained).
- Compact status tabs + single-row filter toolbar; denser table; premium pager; tracking panel heading/status row + 3-button actions (View Order / View PFI / Track Delivery).
- Hero crop nudge via `.so-hero--orders`; completed tracker steps green; `stage=pfi-issued` filters orders with proforma.
- Files: `orders/page.tsx`, `staff-orders.css`, `stages.ts`, `staff-views.ts`, order detail `#tracking` anchor.

### 2026-11-13 — Fix NextAuth CLIENT_FETCH_ERROR locally
- Killed stale multi-port Next.js listeners; AuthProvider pins relative `basePath="/api/auth"` so session fetch stays same-origin.

### 2026-11-12 — Invite/role header icons match text height + fluid Users
- Invite Dealer / Invite Staff / role detail icons stretch to heading+caption height (1:1 tile).
- Users invites/roles spacing and type consume `--tri-*` tokens; tighter form columns on ≤1366px laptops.

### 2026-11-12 — Invite cards: tiny vertical spacing
- Invite Dealer / Invite Staff: slightly more form gap and head/inner padding for clearer vertical rhythm.

### 2026-11-12 — Module-based Roles & Permissions (5 app modules)
- Roles UI: Select Module cards (Dealer / Retail / Depot / Note Taker / Presentations), Module Access switch, contextual Navigation Tab matrix (Attachment 2).
- Extended `PermissionModule` with `access*` gates + dealer/depot/note/pres tab keys; `canUser` requires parent module access; middleware + note-taker/presentations/depot gates.
- Persistence still flat PermissionKey lists on `StaffRoleTemplate` / `SystemSetting` / user overrides; `migratePermissionKeys` infers `accessRetail` from legacy tab grants.
- New: `src/lib/permissions/app-modules.ts`, `role-permissions-panel.tsx`.

### 2026-11-12 — Permissions table denser + mockup line icons
- Reduced row/header vertical padding; removed vertical column rules; light zebra rows.
- Module column icons: thin-stroke slate line icons (no filled blue tiles), aligned like Roles & Permissions mockup.

### 2026-11-12 — Roles permissions: equal columns + admin-editable system matrices
- Permissions table: equal ⅓ columns, premium wrap, header icons (info/eye/pencil), row icons for real Staff/Dealer header tabs (Orders, Analytics, Messages, Support, Users, Settings, Stock Sale Reporting + Admin/Activity).
- Admins with Users write can edit system-role checkboxes; saves persist to `SystemSetting` (`staff.roleDefaults.*`) and apply Allow/Deny overrides to all INTERNAL users on that role so nav/`canUser` enforce immediately after session refresh.
- Custom role templates unchanged; Admin system role cannot drop Admin/Users write.
- Files: `system-role-defaults.ts`, `staff-role-templates.ts`, `permissions.ts`, `api/retail/roles/[id]`, `retail-users-client.tsx`, `retail-users.css`.

### 2026-11-12 — Active Users tab accent: thin top blue bar
- Selected management tab: yellow bottom dash replaced with a thin full-width blue highlight along the top of the blue pill.

### 2026-11-12 — Station dropdown portal + wider panel
- Station menu portals to `document.body` (fixed, z-index 9999) so it is never clipped by Invite Dealer card/`overflow`.
- Wider panel (~1.65× trigger, min 320px); search row forced single-line icon + placeholder with padding.

### 2026-11-12 — Station dropdown match Premium mockup
- Restyled Invite Dealer station multi-select to Premium Invite Dealer Station Selector: tinted search field, light-blue selected rows, square navy checkboxes, circular blue pin badges, white footer with blue count + Clear all.

### 2026-11-12 — Users tabs bare + station label one line
- Removed yellow top accent from Active/Pending/Roles tabs bar.
- Station selector placeholder shortened to “Select station...” and forced single-line ellipsis (no wrap).

### 2026-11-12 — Invite cards fit + bare (no top accent)
- Invite Dealer / Invite Staff: removed colored top highlight (plain white cards).
- Staff row overflow fix: equal `minmax(0,1fr)` columns + `min-width:0` on fields so Last Name stays inside the card.

### 2026-11-12 — Invite cards: blue accent + tinted inputs
- Invite Dealer / Invite Staff: top highlight is Trinity blue (`#3551A5`), not yellow.
- Input controls: fixed ~2.05rem height, light blue fill `rgba(53,81,165,0.06)`, matching mockup sleek row.

### 2026-11-12 — Users page mockup polish (yellow accents + denser cards)
- Removed Invite Dealer corner forecourt image (card is all white).
- Yellow top accent on invite cards, tabs bar, content panels, roles side/main.
- Tighter vertical spacing: shorter inputs/buttons, denser invite/roles/table padding; tabs in a white bar; square perm checkboxes like mockup.

### 2026-11-12 — Staff Portal hero unified to Messages plate
- Extracted Messages `.so-hero` into shared `staff-portal-hero.css` (asset `trinitynrg-forecourt-at-sunset.png?v=5`, `background-size:cover`, `background-position:42% 30%`, `min-height:220px`, same padding/gradient).
- Home / Stock Sale Reporting / Users / Orders / Support / Messages all use that exact plate (no per-page `<img>` 128% crop). Markup aligned to Messages eyebrow/title/sub pattern.
- Fix: CSS `@import` of the shared hero failed under Turbopack (Home showed navy block + dark text). Import `staff-portal-hero.css` from `staff-portal-shell.tsx` instead so every Staff Portal page loads the plate.

### 2026-11-12 — Fix Users route conflict (home vs workspace)
- Removed `(workspace)/users` — Next.js cannot have parallel `users` pages under `(home)` and `(workspace)` for the same path. Users lives only under Staff Portal `(home)/users`; header Users nav already points there.

### 2026-11-12 — Staff Portal Users Management redesign
- Moved `/intelligence/retail/users` under Staff Portal `(home)` shell (hero + horizontal nav).
- Premium light UI: sunset forecourt hero, Invite Dealer / Invite Staff cards overlapping hero, three tabs (Active Users, Pending Invitations, Roles & Permissions).
- Invite Dealer: searchable multi-station selector (Upload 4), org identification panel (Upload 5), existing invite API + External ID rules.
- Invite Staff: department + role dropdown; custom role templates apply as permission allow-ticks on invite.
- Roles: system roles (Admin / Executive / Staff Member) + `StaffRoleTemplate` CRUD; Create Role modal (Upload 6); permission matrix READ/WRITE; duplicate/edit/delete for custom templates.
- New: `prisma` model + migration `20261112120000_staff_role_templates`, `src/lib/users/staff-role-templates.ts`, `/api/retail/roles`, `create-role-modal.tsx`; rewritten `retail-users-client.tsx` / `retail-users.css` / `station-multi-select.tsx`.
- Staff Portal nav: Users link when `retailUsers.view`.

### 2026-11-11 — Monetary export + site fluid scale
- Monetary Sales: single **Export Report** dropdown (CSV / Excel / PDF), same pattern as reconciliation.
- Site-wide fluid root (`--tri-root-font`) + wider `--tri-content-max`; dealer hero grows with content (no CTA clip); staff wraps use content-max token.

### 2026-11-11 — Monetary Sales controls + payment legend
- Period/date toolbar: segmented control + pill date field (mockup layout).
- Collections payment rows: bordered pills filling the card; Cash/M-Pesa/Card colors match mockup (blue / yellow / light blue).

### 2026-11-11 — Stock Intelligence mid-row polish
- Sales Performance: horizontal PMS/AGO pills with volume + bar beside (not stacked).
- Layout: Tank Levels + Sales Performance side-by-side; Targets & Projections full-width below (no table scroll).
- Tank Levels: cylinder cap/base, product badges, gloss + meniscus fill styling.

### 2026-11-11 — SSR reconciliation layout polish
- Stations sidebar capped to right-pane height (`height:0; min-height:100%`) with internal scroll; station name + dealer badge; Trinity yellow dots.
- Sync official catalog stations into DB when short (`ensureOfficialStationsInDb`) so all ~22 stations list.
- Section selectors: always yellow top accent (selected + idle); blue fill when active; no yellow bottom underline.
- Caption on its own full-width row (single line); **Export Report** dropdown.

### 2026-11-11 — SSR section selector cards
- Stock Sale section cards restyled like Staff Home KPI cards (top accent borders, softer shadow); removed yellow underline on selected state; kept blue fill when active.

### 2026-11-12 — Dealer heroes use staff-identical <img> crop
- Background-image crop could not match staff. Dealer portal heroes now render `<DealerHeroMedia />` — same asset and exact CSS as staff `.sh-hero__img` / `.ssr-hero__img` (`width:128%`, `height:100%`, `object-fit:cover`, `object-position:18% 30%`).
- Wired on dashboard, orders, order tracking, place order, stock reporting/wizard/submitted, messaging, support. Access/login/forgot-password unchanged.
- Fix: force `max-width:none` + `height:100% !important` so Tailwind/preflight `img { max-width:100%; height:auto }` cannot collapse the plate to a top-sky-only crop (canopy was falling below the hero).

### 2026-11-11 — Staff hero revert to prior forecourt plate
- Reverted staff Home/SSR heroes to `trinitynrg-forecourt-at-sunset.png?v=6` with prior `128%` left-pin / `object-position: 18% 30%`. Messaging/Analytics/Dealers back to `dashboard-hero-station.jpg` prior crop.

### 2026-11-11 — Targets modal drop cover-alert UI
- Removed non-mockup **Cover alert days** (Warn/Crit) editors from the targets modal; Alert Level stays badge-only. Defaults (warn 3 / crit 1) still drive classification server-side.

### 2026-11-11 — Targets modal compact + bidirectional cascade
- Scaled Set Sales Targets modal to fit one laptop view; station + Target Period styled to mockup; holdings alert column is badge-only so no horizontal scroll.
- All Daily/Weekly/Monthly/Yearly fields editable; any edit cascades via daily rate (÷7/÷30/÷365). Live comparisons use actual calendar days in the selected month/year (`comparisonPeriodTarget`).
- Files: `staff-stock-intelligence.tsx/.ts`, tests, stock-reporting page (intel + monetary), `staff-stock-reporting.css`.

### 2026-11-11 — SSR recon controls single row
- Stock Reconciliation period chips + date + 3 KPI cards stay on one line (mockup): `.ssr-controls` `nowrap`, chips `nowrap`, KPIs `margin-left: auto` and shrink; wrap only below 800px.

### 2026-11-11 — SSR hero canopy further right
- Wide laptop heroes are width-locked under `object-fit: cover`, so `object-position` X alone had no visible pan. Hero img now `width: 128%` pinned `left: 0` (SSR + Staff Home) so the right of the plate is cropped and the canopy sits further right; cache `?v=6`.

### 2026-11-11 — SSR hero canopy crop
- Stock Sale Reporting hero `object-position` nudged left (42% → 28%) so the station canopy sits further right in frame.
- Hero copy vertically centered and nudged right for professional placement (SSR + Staff Home).

### 2026-11-11 — Staff targets modal redesign (Stock Intelligence)
- Redesigned **Set Sales Targets & Stock Thresholds** modal to match approved mockup: header copy, section focus tabs (both panels stay visible), station selector, target-period emphasis, PMS/AGO badges, auto-calc + how-it-works info boxes, footer actions.
- Preserved existing `StationStockIntelligenceConfig` GET/PUT, ×7/×30/×365 derivation (null = derived), two-day holding derivation, computed alert preview + warn/crit cover days, unsaved-change confirm, station switch load/save.
- Files: `staff-stock-intelligence.tsx`, `staff-stock-reconciliation.tsx` (stations wiring), `staff-stock-reporting.css`.

### 2026-11-11 — Staff SSR station labels + Home container polish
- Stock Sale Reporting sidebar lists **Dealer — Station** for every mapped station (sorted by dealer), scrollable list panel.
- Staff Home containers: light dealer-style top accent borders on KPI / ops / intel cards (Trinity blue/yellow accents).
- Prisma singleton freshness: require `stationStockIntelligenceConfig` delegate (fixes Turbopack stale client `findFirst` crash).

### 2026-11-11 — Staff Monetary Sales (Stock Sale Reporting §3)
- Implemented Monetary Sales section on shared SSR shell: 7 KPIs, revenue breakdown (snapshotted shift prices / weighted avg), collections donut (Cash/M-Pesa/Card), targets vs actual (volume targets × price), SVG revenue trend (missing days not zeroed).
- Aggregation in `staff-monetary-sales.ts` from CLOSED `StockSaleReport` monetary fields; monetary variance = collections − expected revenue (separate from target variance). Export supports `section=monetary` (CSV/XLS/PDF). View Shift Reports reuses shifts page.
- Files: `staff-monetary-sales.tsx`, helpers/tests, page loader, export route, CSS.

### 2026-11-11 — Staff Stock Intelligence (Stock Sale Reporting §2)
- Implemented Stock Intelligence section (shared hero/section cards/station sidebar): 6 KPIs, tank level viz from `StationTank`, sales performance bars, targets & projections, stock holding/replenishment, forecast outlook.
- New effective-dated `StationStockIntelligenceConfig` (+ migration); Set Targets & Thresholds modal (config-only) via PUT `/api/intelligence/stock-reporting/targets` (activity-logged). Contact Dealer → messaging deep-link `?c=`.
- Calcs in `staff-stock-intelligence.ts` (cover = stock÷avg CLOSED sales; station cover = min product; projections from avg×remaining days). Missing targets show “Not configured”; orders in transit noted but not counted as stock.
- Files: `staff-stock-intelligence.tsx`, intelligence helpers/tests, targets + contact-dealer APIs, schema/migration, messaging `?c=` open, CSS + page loader.

### 2026-11-11 — Staff Stock Reconciliation (Stock Sale Reporting §1)
- Replaced thin missing/closed lists with mockup Stock Sale Intelligence page: hero (same forecourt plate), 3 section cards, station sidebar + search, period controls, KPIs, recon table, insights, report details.
- Live aggregation from CLOSED `StockSaleReport` + tank/pump readings (`staff-reconciliation.ts`). Received/Purchases = 0 until delivery ledger exists. Completeness = CLOSED days vs expected Nairobi days (future days clipped).
- View Shift Reports list + variance explanations; export CSV / SpreadsheetML `.xls` / PDF via `/api/intelligence/stock-reporting/export` (activity-logged). Stock Intelligence / Monetary Sales cards navigate to placeholders only.
- Files: `(home)/stock-reporting/page.tsx`, `shifts/page.tsx`, `staff-stock-reconciliation.tsx`, `staff-stock-reporting.css`, `staff-reconciliation.ts` (+test), export route.

### 2026-11-11 — Staff Home hero/KPI layout polish
- Hero crop: `object-position: 42% 30%` + `--tri-hero-height-capped` so the blue Trinity canopy/fascia reads (not underside-only); nudged left vs prior right-heavy crop.
- KPI cards: horizontal icon | label/value/meta row (sleeker, shorter); tighter ops/intel panel padding and row gaps toward mockup density.
- Files: `staff-home.css`, `staff-home-dashboard.tsx` (KPI markup).

### 2026-11-11 — Staff Portal Home Dashboard redesign
- Replaced dark Retail Interface sidebar home with light Staff Portal shell (`StaffPortalShell`) + cinematic home (`StaffHomeDashboard`).
- `/intelligence/retail` now serves operational home (KPIs, Needs Action, activity, sales/losses, EPRA countdown) from live Neon data.
- Moved prior analytics dashboard to `/intelligence/retail/analytics`.
- Nav trimmed to Home / Orders / Analytics / Messages / Support / Settings / Stock Sale Reporting; header forced to a single non-wrapping row (fixes double-bar wrap).
- Needs Action only lists real outstanding counts; EPRA task only within 7 days of the next 15th.
- Added staff Support + Stock Sale Reporting list pages under `(home)` (live Prisma data).

### 2026-11-11 — Staff forgot-password split-screen redesign
- Rebuilt `/intelligence/forgot-password` on the shared `.dl` portal-auth shell (forecourt plate + right card) to match the Staff Password Reset mockup.
- Preserved reset API, portal-aware back-to-login (`?portal=`), and mailto support. Scoped `.dl--reset` card/CTA styles so login pages are unchanged.

### 2026-11-09 — Remove redundant PFIs header nav
- Dropped the top-level **PFIs** link from `DEALER_PRIMARY_NAV` (`src/lib/dealer/nav.ts`); it only opened `/dealer/orders?view=documents` and crowded Stock Sale Reporting.
- Orders page still has the **PFIs & Documents** sub-tab. Primary highlight for that view stays on **Orders**.

### 2026-11-09 — Trinity site-wide responsive token system
- Added `src/styles/responsive-tokens.css` (`--tri-font-*`, `--tri-space-*`, `--tri-page-gutter`, content max, short-height hero caps) imported from `globals.css` as `layer(base)` so Tailwind v4 keeps `:root` defs.
- Remapped Access, portal-auth, staff login leftovers, dealer portal shell + modules (dashboard, orders, place-order, tracking, SSR/wizard, messaging, support) to tokens; hero uses capped `--dp-hero-height`.
- Staff TRI retail shell/titles + short-height padding; depot continues via shared dealer login/portal CSS.
- Cursor rule `.cursor/rules/responsive-tokens.mdc`: new UI must consume `--tri-*` (no parallel hard-coded major type/spacing).
- Smoke: Access + dealer login — no shell overflow at 1280×720 / 1366×768 / 1440×900 / 1920×1080 / 390×844; short-height caps hero to 180px (≤800) / 150px (≤720).
- Scope: proportional scale/reflow only; dedicated mobile card UIs deferred.

### 2026-11-09 — RTT form field sizing polish
- Full-width reason textarea (no vertical resize); shared 42px input/select height; map panel aligned to control height.
- File: `dealer-stock-reporting.css`, `rtt-calibration-page.tsx`.

### 2026-11-09 — RTT Record New form redesign (mockup + job card)
- Redesigned Record New RTT: pump select, auto product/tank info panel, volume, required reason (250 chars), optional PDF job card (drag/drop, 10 MB).
- Server timestamp only; pump→tank via `linkedTankForPump` (PMS-1→PMS Tank 1); block saves when day CLOSED; optional PDF stored under `.data/rtt-job-cards`.
- Today's RTT by Pump columns + Activity Log (reason, job card download). Migration `20261109193000_station_pump_rtt_job_card`.
- Files: `rtt-calibration-page.tsx`, `dealer-stock-reporting.css`, `rtt.ts`, `rtt-storage.ts`, `rtt-constants.ts`, `actions.ts`, job-card API route, schema/migration, `rtt-mapping.test.ts`.

### 2026-11-09 — Fix stale Prisma findMany crash (Turbopack)
- Hardened `prisma.ts` to recreate the client when any SSR/support delegate is missing (`stockSaleReport`, RTT, tickets, etc.). Regenerated client; killed stale Node on :3000.
- File: `src/lib/prisma.ts`.

### 2026-11-09 — Staff + depot login match dealer shell/forecourt
- Trinity Staff and Depot logins now use the same left forecourt plate (`trinitynrg-forecourt-at-sunset.png`, cover/center) and dealer login card UI via shared `portal-auth.css` + `PortalLogin` / `BrandPanel`.
- Files: `portal-login.tsx`, `portal-auth.css`, `intelligence/login/page.tsx`, `depot/login/page.tsx`, `dealer/login/page.tsx`, `activate-password-form.tsx`.

### 2026-11-09 — Access headline: two lines like dealer login
- Caption breaks as “One connected platform” / “for Trinity Energy.” (explicit `<br />`, wider max-width).
- Files: `access/page.tsx`, `access.css`.

### 2026-11-09 — Access forecourt: remove navy letterbox, full-bleed again
- The blue frame was the panel `#071833` showing through `scale(0.86)`. Reverted access to full-bleed `background-size: cover` (same as dealer login). Zoom-out-via-scale is not viable without letterboxing.
- Files: `access/page.tsx`, `access.css`, `dealer-login.css`.

### 2026-11-09 — RTT page: equal-height top cards
- Stretch Record New RTT to match Today's RTT by Pump; pin Save/Clear to the card foot.
- Files: `rtt-calibration-page.tsx`, `dealer-stock-reporting.css`.

### 2026-11-09 — Report Records: single Reporting Date filter
- Replaced date-range (`from`/`to`) with one `date` query param — filter/export for that reporting day only.
- Files: `report-records-page.tsx`, `records/page.tsx`, `api/stock-reporting/records/export/route.ts`, `dealer-stock-reporting.css`.
- Legacy `from`/`to` still accepted as fallback when `date` is absent.

### 2026-11-09 — Report Records filters/export match mockup

- Filter row: white fields on card (no grey tray), mockup date display `01 Oct 2026 – 09 Nov 2026` with dual overlay date pickers, Apply yellow shadow + Clear outline.
- Export: light-blue `#EEF4FF` button with download icon + chevron and green spreadsheet menu icons.

### 2026-11-09 — Report Records UI, filters, pagination, CSV/Excel export

- Rebuilt `/dealer/stock-reporting/records` to match mockup: hero copy, card header + Export menu, date-range + status filters, Apply/Clear, table (date/pumps/tanks/sales/revenue/collections/status/actions), pagination.
- Drafts + closed listed together; Resume opens `nextIncompleteStage`; incomplete numeric cells show `—`.
- Export API `/api/stock-reporting/records/export` (CSV + SpreadsheetML `.xls`) respects filters/station auth; formula-injection sanitized.
- `listReportRecords` now returns `{ rows, total }` with date range + skip/take; no schema migration (existing DRAFT/CLOSED boundary preserved — close only via Close Shift).

### 2026-11-09 — SSR dashboard: reuse Dealer Dashboard order progress CSS

- Today’s Stock Report stage rail now uses the same `.dd__progress*` markup + `dealer-dashboard.css` (with `!important`) as the dashboard order tracker — fixes unstyled/plain-text rail from SSR-only classes not applying.

### 2026-11-09 — Pump meters: numeric-only fields, 4 significant figures

- Opening/closing meter inputs strip non-numeric characters while typing and round to 4 significant figures on blur (`sanitizeNumericLitresDraft` / `commitLitresField`).

### 2026-11-09 — Pump meters: force first-time banner styles + drop How it works

- Removed **How it works** from Pump Meter Readings.
- Banner + **Initial Setup** pills now use inline styles (plus CSS) so Turbopack CSS cache can’t leave them unstyled; restarted clean dev on `:3001`.

### 2026-11-09 — Pump meters: first-time setup banner + Initial Setup badges

- Banner matches mockup: `#EEF4FF` / `#C5D6FF`, 12px radius, 20×12–14 padding, 24px info icon, vertical divider, 16px bold heading + 13.5px muted description.
- Uninitialized opening inputs show a right-aligned yellow `#FFF0A8` **Initial Setup** pill; inherited openings stay read-only without the badge.

### 2026-11-09 — Pump meters: compact first-time meter setup banner

- Replaced large yellow opening-init copy with a compact premium banner above the readings table: heading **First-Time Meter Setup**, short description, light blue `#EEF4FF` / border `#D3E1FA`, icon chip. Still only when any pump needs initialization.

### 2026-11-09 — Pump meters: move opening-init copy above table

- Removed per-row “Initial opening…” hints and “View RTT Records” links under table cells.
- When pumps need first-time opening entry, show one notice above the table explaining first-report editability and that openings will carry forward from prior closings afterward.

### 2026-11-09 — Fix stale Prisma client missing StationPumpRttEvent

- Dev crash `Cannot read properties of undefined (reading 'groupBy')` on pump-meters / RTT: Turbopack kept a pre-migration Prisma singleton without `stationPumpRttEvent`.
- `prisma.ts` now recreates the client when that delegate is missing; RTT totals aggregate via `findMany` instead of `groupBy`. Restarted `npm run dev` after `prisma generate`.

### 2026-11-09 — RTT & Truck Calibration + Report Records + opening meters

- New module `/dealer/stock-reporting/rtt` matching approved mockup: summary cards, RTT Recording / Truck Calibration tabs (truck = empty state), Record New RTT form, Today’s RTT by Pump, Activity Log with view/correct.
- Sidebar: **Stock Reporting**, **Report Records**, **RTT & Truck Calibration** (history + downloads consolidated; old routes redirect).
- Schema: `StationPump.meterInitialized` + `StationPumpRttEvent` (migration `20261109190000_station_pump_rtt_events`) — multiple RTT events per pump/day with idempotent `submissionKey` and correction audit.
- Pump meters: opening editable only for uninitialized pumps; RTT Applied read-only from live events; net sales auto-recalculate; RTT recorded before/during draft syncs into open reports.
- Files: `rtt.ts`, `rtt-calibration-page.tsx`, `records/page.tsx`, pump/form/constants/actions updates, `rtt-calc.test.ts`.

### 2026-11-09 — Remove decorative blue/yellow waves system-wide

- Removed layered blue/yellow wave SVGs from Stock Sale Reporting (nav + cards + wizard), Support Centre, and dealer Messaging empty thread. Deleted `stock-reporting-waves.tsx` and related CSS.

### 2026-11-09 — Dealer hero: new forecourt plate (exact as provided)

- Replaced shared portal hero with `forecourt-hero-banner-v4.jpg` (native **1024×211**, as attached). Still shown full-bleed at native aspect (`100% 100%`, height `calc(100vw * 211 / 1024)`), no cover crop. Used via `dealerHeroPhotoStyle` on every dealer portal page hero.

### 2026-11-09 — Fix ensureStationPumps/Tanks unique constraint crash

- `ensureStationPumps` / `ensureStationTanks` only looked for `active: true`, then `createMany` collided with inactive (or concurrent) rows on `(stationId, pumpKey|tankKey)`. Now upserts missing keys and reactivates inactive defaults.

### 2026-11-09 — Dealer hero: show full forecourt plate (no cover zoom)

- Dropped `background-size: cover` / `72% 42%` crop. Hero now uses the full `forecourt-hero-banner-v3.jpg` (5120×745) at `100% 100%` with height `calc(100vw * 745 / 5120)` so the plate is not scaled in or out of its native aspect.

### 2026-11-09 — Stock Sale Reporting: Submitted confirmation page

- Post-close confirmation at `/dealer/stock-reporting/report/[id]/submitted` matching the approved success mockup (sidebar completed stages, success banner, stock/monetary cards, actions).
- Persists stable `reportReference` (`SSR-{CODE}-{YYYY-MM-DD}`) + equipment snapshot on close; PDF via `/api/stock-reporting/reports/[id]/pdf`; print stylesheet; New Daily Report blocked when today’s report is already closed.
- History shows reference + View/PDF; close redirects only after backend success.

### 2026-11-09 — Stock Sale Reporting Step 4: Monetary Reconciliation

- Full wizard UI for `/dealer/stock-reporting/monetary`: expected sales table, expected vs collections, Cash/M-Pesa/Visa inputs, status banners, confirm modal, close shift.
- Schema: monetary fields + `MonetaryState` + `StockSaleMonetaryAudit` (migration `20261109170000_stock_sale_monetary`).
- Expected sales = meter volume × snapshotted EPRA max pump prices (temporary; flags missing prices / no intra-day allocation). Exact balance required to close; discrepancy notes saved but do not unlock closure.
- Files: `monetary-form.tsx`, `lib/stock-reporting/monetary.ts`, `monetary-calc.ts`, report detail success state.

### 2026-11-09 — Stock Sale Reporting Step 3: Wet Stock Reconciliation

- Full wizard UI for `/dealer/stock-reporting/wet-stock`: meter vs tank vs variance cards, resolution radio options (delivery / review / loss), draft/continue/save&exit.
- Schema: wet fields on `StockSaleReport` + `StockSaleWetAudit` (migration `20261109160000_wet_stock_reconciliation`). Variance = Meter − Tank (signed). No fabricated deliveries. Loss = pending review acknowledgment. Source edits invalidate wet decisions.
- Monetary page gated until Step 3 complete.
- Applied migration `20261109160000_wet_stock_reconciliation` to Neon; fixed `WetStockState` typing in `wet.ts` (draft/complete state assignment).

### 2026-11-09 — Stock Sale Reporting Step 2: Tank Dip Readings

- Full wizard UI for `/dealer/stock-reporting/tank-dips` matching Tank Dip mockup (table, ullage/sales, summary cards, back/draft/continue).
- Schema: `StationTank`, `StockSaleTankReading` (migration `20261109150000_stock_sale_tank_readings`). Sales = Opening − Closing; Ullage = Capacity − Closing; provisional when closing &gt; opening. Completing advances to wet-stock stub with meter/tank totals retained.
- Files: `tank-dips-form.tsx`, `lib/stock-reporting/tanks.ts`, `tank-calc.ts`, wet-stock page gate.

### 2026-11-09 — Stock Sale Reporting Step 1: Pump Meter Readings

- Full wizard UI for `/dealer/stock-reporting/pump-meters` matching Daily Fuel Stock Report mockup (sidebar stages, summary cards, readings table, totals, draft/continue/save&exit).
- Schema: `StationPump`, `StockSalePumpReading` (migration `20261109140000_stock_sale_pump_readings`). Sales = Closing − Opening − RTT; openings from last closing; complete stage advances to tank-dips stub.
- Files: `dealer-stock-wizard.css`, `pump-meters-form.tsx`, `stock-reporting-wizard-shell.tsx`, `lib/stock-reporting/pumps.ts`, `pump-calc.ts`.

### 2026-11-09 — Default station tanks: 2 PMS + 2 AGO

- Temporary equipment default for every station: 4 pumps, 4 tanks (2 PMS + 2 AGO). Persisted on `Station.pumpCount` / `tankCount`; summary card shows `4 Pumps · 2 PMS · 2 AGO`.

### 2026-11-09 — SSR station load: stale Prisma client

- “No station” / “Could not load station configuration” was `Unknown field pumpCount` from a Turbopack-cached Prisma client older than migration `20261109120000_stock_sale_reports`. Regenerated client + restarted `npm run dev`.

### 2026-11-09 — SSR heroes: Place an Order + Pay PFI

- Stock Sale Reporting dashboard + module shell heroes now include shared `DealerHeroActions` (same as Orders / Messages / Support).

### 2026-11-09 — Header: drop Place an order, space nav

- Removed yellow **Place an order** from `DealerShell` desktop header (kept in mobile secondary menu).
- Gave primary nav more room and even spacing so **Stock Sale Reporting** no longer collides with search.

### 2026-11-09 — Hero vs access/login image split

- Portal heroes (all dealer pages via `hero.ts`): new ultrawide panoramic `forecourt-hero-banner-v3.jpg?v=63` (from uploaded 1.5× plate; upscaled 5120×745). Framing `cover` / `72% 42%`.
- Access gateway + dealer login left panels: `trinitynrg-forecourt-at-sunset.png` (mockup `Trinitynrg Forecourt at Sunset.png`) — deliberately **not** the hero plate.
- CSS: `access.css`, `dealer-login.css`, portal hero CSS vars.

### 2026-11-09 — Stock Sale Reporting main dashboard

- New dealer module `/dealer/stock-reporting` matching approved Stock Sale Reporting mockup (hero, module nav + waves, summary cards, today’s progress tracker, Reporting Process guide, Recent Reports table).
- Primary nav: **Stock Sale Reporting**; header **Place an order** CTA added to match mockup.
- Persistence: Prisma `StockSaleReport` (+ `Station.pumpCount` / `tankCount`) migration `20261109120000_stock_sale_reports`. Start/Continue/Start Over (draft reset with confirm) via server actions; stage wizard screens are stubs pending follow-up.
- Sub-routes: history, downloads (boundary stub), report detail (org-scoped), pump-meters / tank-dips / wet-stock / monetary stubs.
- Files: `src/app/dealer/dealer-stock-reporting.css`, `src/components/dealer/stock-reporting-*.tsx`, `src/lib/stock-reporting/*`, nav + shell updates.
- **DB note:** `npx prisma migrate deploy` applied `20261109120000_stock_sale_reports` against the database configured in local `.env` (Neon `ep-quiet-wildflower-zaag2pmh`) during implementation. Confirm staging parity separately if staging uses a different URL.

### 2026-11-09 — Hero: closer canopy zoom (not farther)

- Stopped “farther back” framing. Hero photo now `background-size: 155%` with position `78% 34%` so the station canopy reads closer/larger on the right. CSS vars `--dp-hero-photo-size` / `--dp-hero-photo-position` wired through portal + page hero rules. Cache `?v=62`.

### 2026-11-07 — Hero: swap panoramic plate (Twilight forecourt)

- Swapped hero to user `Twilight_at_Trinitynrg_Fuel_Station` (native still 1024×341; exported 5120×1707 for cover). Same framing (canopy right). Cache `?v=61`.

### 2026-11-07 — Hero: continuous panoramic forecourt plate

- Replaced spliced banner with user-provided continuous panoramic `Trinitynrg Sunset Forecourt` (~1024×341 → 3× 3072×1023 JPG). Canopy already parked right with open left sky/pavement; CSS `cover` spans full hero width (no sky duplicate). Position `center 28%` for sky+canopy. Cache `?v=60`.

### 2026-11-07 — Hero: ultrawide master (7680×1120) + mockup framing

- Cursor `GenerateImage` unavailable; photo-sourced ultrawide splice attempts (`?v=58`–`v=59`) superseded by continuous panoramic plate above.

### 2026-11-07 — Hero: sky full-bleed + canopy farther (mockup framing)

- Yes, possible: CSS `cover` alone cannot zoom the canopy out on ultrawide viewports, so the banner is precomposed. Earlier `?v=57` plate superseded by ultrawide master above.

### 2026-11-07 — Hero: sky full-bleed + canopy farther right (earlier)

- Precomposed sky + station crop iterations (`?v=41`–`v=56`); superseded by mockup-matched plate above.

### 2026-11-07 — Hero restore: cover + right bias

- Removed transform/img scale layer (black void on right, missing hero copy). Back to simple `background-image` + `cover` on original `forecourt-sunset.jpg`, position `78% 32%` so canopy sits on the right. Veils still off. Cache `?v=39`.

### 2026-11-07 — Hero farther without stretch (img + object-fit)

- Careful zoom-out: `<DealerHeroPhoto />` uses the original `forecourt-sunset.jpg` in a real `<img>` with `object-fit: cover` + `scale(0.70)` / origin `60% 28%` — canopy farther/center-right, aspect preserved (no ultrawide bake). Veils still off. Cache `?v=38`. Superseded — scale left black gap + missing copy.

### 2026-11-07 — Hero unstretch: original photo + cover

- The “farther” ultrawide bake stretched the whole photo. Reverted to unmodified `forecourt-sunset.jpg` with `background-size: cover` (aspect preserved) and `62% 30%`. Veils still off. Cache `?v=37`.

### 2026-11-07 — Hero farther plate (simple background again)

- Dropped the broken scale/photo-layer experiments (solid orange). Baked crisp continuous `forecourt-sunset-hero.jpg` from the high-res PNG with a wider vertical FOV so the canopy reads farther; normal `background-image` + cover. Veils still off. Cache `?v=36`. Superseded — that bake stretched the image.

### 2026-11-07 — Hero farther + crisp (DOM photo layer)

- Added `<DealerHeroPhoto />`: high-res `forecourt-sunset.png` on a real layer (`scale 0.56`, origin `60% 26%`) so the canopy reads farther/center-right without composites or washes. Veils still off. Cache `?v=35`. Superseded — layer failed to paint (solid orange).

### 2026-11-07 — Hero photo restore (fix broken ::before scale)

- Reverted the `::before` transform scale layer (photo vanished → solid navy). Restored raw `forecourt-sunset.jpg` as the hero `background-image` with `cover` + `62% 28%` (center-right). Veils still off. Cache `?v=34`.

### 2026-11-07 — Hero canopy farther via CSS scale (raw photo)

- Kept unmodified `forecourt-sunset.jpg`. Framed canopy farther / center-right with a shared `::before` photo layer (`scale 0.52`, origin `60% 24%`) — no composites, no veils. Tokens in `hero.ts` (`?v=33`). Superseded — photo layer failed to paint.

### 2026-11-07 — Hero reset to raw sunset photo (no washes)

- Pointed all dealer heroes at unmodified `forecourt-sunset.jpg` (same bytes as `Trinitynrg Forecourt at Sunset.jpg`). Removed CSS hero veils/washes on dashboard, orders, place-order, messaging, support, order-tracking, and portal shell. Cache `?v=32`. Baseline before any further framing.

### 2026-11-07 — Hero canopy farther back (mockup scale)

- Rebaked single `forecourt-hero-banner-v2`: true upper-sky golden plate (no canopy in sky strip) + station object ~56% width on the right with sky above the blue fascia and open left for hero copy — farther than the full-bleed underside zoom. Cache `?v=31`.

### 2026-11-07 — Hero canopy high + open left sky (single plate)

- Removed two-layer CSS (station sank under the summary cards). Rebaked single `forecourt-hero-banner-v2` underside strip with canopy high (~20% from top), left canopy bleed cleared to golden sky for hero copy, continuous plate (no cool divide). Cache `?v=30`.

### 2026-11-07 — Hero canopy farther out (two-layer mockup framing)

- Ultrawide single-strip crops kept stretching the canopy full-bleed; switched to two-layer heroes: golden `forecourt-hero-sky.png` plate + natural-aspect `forecourt-hero-photo.png` sized farther out on the right (`auto ~205%` height, soft left mask). Shared CSS on all dealer heroes; tokens in `hero.ts` (`?v=26`). Superseded by single-plate `?v=30`.

### 2026-11-07 — Hero canopy farther out (mockup framing)

- Rebuilt `forecourt-hero-banner-v2` from `forecourt-sunset.png` as one continuous strip (no sky composite): more sky above the canopy so the station reads farther out like the Dashboard mockup; soft left-sky warmth only to keep the plate golden without bringing back the cool divide. Cache `?v=20`.

### 2026-11-07 — Hero canopy left/up + seam past MEMISI

- Rebaked `forecourt-hero-banner-v2` from the v18 plate: ~22% further left crop + ~15% bottom cut (canopy higher) and a soft left-sky warmth blend so the cool/golden divide sits left of hero copy (second M in MEMISI). Softened left hero veils. Cache `?v=19`.

### 2026-11-07 — Hero left-sky seam soft color grade

- Restored original banner, then baked a ~14% left crop into `forecourt-hero-banner-v2` so canopy sits further left and cool-sky seam moves off the hero-copy zone (CSS `background-position` cannot pan on wide viewports with cover). Softened left hero veil. Cache `?v=18`.

### 2026-11-07 — Support nav yellow + brand yellow normalization

- Support Centre left-nav active state: solid Trinity yellow `#ffcc00` only — removed the inset left streak (`box-shadow: inset 3px 0 0`).
- Replaced darker brand yellows (`#f5b800`, `#ffb800`, `#ffc107`, `#f0a500`, `#ffd633`, `#ffc933`, related rgba) with `#ffcc00` across dealer + shared UI tokens (`globals.css` included). Soft pale tint backgrounds left as washes.

### 2026-11-07 — Uniform dealer hero on Messages + Support

- Messages/Support heroes were shortened to 185px (and Messages further to 160px on narrow viewports), which cropped/squashed the shared forecourt banner vs Dashboard/Orders (`--dp-hero-height: 260px`).
- Locked `.dm__hero` / `.ds__hero` to `--dp-hero-height`, matched Orders veil + inner padding (`1.55rem` / `3.85rem`), removed Messages mobile height shrink.
- Files: `dealer-messaging.css`, `dealer-support.css`.

### 2026-11-07 — Support Centre Contact Trinity tab (Tab 4)

- Built Contact Trinity mockup: four reach methods (ticket / messages / tel / mailto), department grid preselecting Raise Ticket department, right-side contact info / hours / urgent call card, contact hero subtitle + waves.
- Contact config: `SUPPORT_EMAIL`, `PFI_COMPANY.phones`, `SUPPORT_LOCATION`, `SUPPORT_HOURS` in company contact module; Raise form accepts `initialDepartment` via state + `?department=`.
- Files: `support-centre.tsx`, `dealer-support.css`, `support/page.tsx`, `support-card.tsx`, `lib/company/contact.ts`.

### 2026-11-07 — Support Centre FAQ tab (Tab 3)

- Implemented Frequently Asked Questions to match approved mockup: searchable accordion, category pills, Still need help / Quick Links / speak cards, FAQ-active left nav (pale yellow + yellow bar), hero subtitle for FAQ.
- Structured FAQ data in `lib/support/faq-data.ts` (filter by category + keywords); unit tests in `faq-data.test.ts`.
- Files: `support-centre.tsx` (FaqPanel/FaqAside), `dealer-support.css`, `faq-data.ts`, `faq-data.test.ts`, `support/page.tsx` (section query).

### 2026-11-06 — Hero CTAs aligned like Dashboard

- Removed floating shell Pay bar. **Place an Order** + glowing **Pay for this PFI** sit under hero copy (left) on Orders / Order Tracking via `DealerHeroActions` + `PayPfiProvider`. Dashboard unchanged. Place Order page shows Pay CTA only when payable.

### 2026-11-07 — Raise a New Ticket mockup fidelity

- Rebuilt Raise Ticket tab to match approved form mockup: back link, yellow ticket header + waves, Your details identity cards, department/priority row, subject/description with 2,000 counter, related ref + dropzone, Cancel/Submit footer.
- Right column switches to Ticketing Guide + Priority Levels on Raise tab. Description max synced to 2,000 in constants/service.
- Files: `support-centre.tsx`, `dealer-support.css`, `lib/support/constants.ts`, `lib/support/service.ts`.

### 2026-11-07 — Dealer Support Centre + ticketing system

- Replaced Support popup with full `/dealer/support` page matching My Tickets mockup (hero, 3-column workspace, filters, table, status guide).
- Prisma models: `SupportTicket`, messages, attachments, events, sequence (`TRN-*`); migration `20261107100000_support_tickets`.
- Dealer APIs for create/list/detail/reply/download; staff foundation APIs under `/api/support/staff/*` + `support` permission module.
- Local private attachment storage under `.data/support-uploads` (MIME sniff + size limits). FAQ + Contact Trinity sections; ticket detail page with timeline + conversation.
- Header Support is a real nav link (yellow active). Files: `support/*`, `dealer-support.css`, `support-centre.tsx`, `support-ticket-detail.tsx`, `nav.ts`, `permissions.ts`, schema/migration.

### 2026-11-06 — Dealer Messaging premium two-state redesign

- Rebuilt `/dealer/messaging` to match approved empty + selected mockups: shared forecourt hero, light canvas, three floating white panels (~29/43/28).
- State A: empty chat illustration + CTA + waves; Contact Intelligence idle with Recent Orders / Shared Files cards.
- State B: selected row (yellow accent), active thread, composer, profile + Related Orders / Shared Files from real context API.
- Fixed `MessagingApp` dealer class (`msg-app--dealer`); staff dark UI unchanged. Preserved Pusher, send, directory, unread filters.
- Files: `messaging/page.tsx`, `dealer-messaging.css`, `messaging-app.tsx`, `messaging.css`.

### 2026-11-06 — Pay PFI modal smaller + above everything

- Modal portaled to `document.body` with `z-index: 10000` so KPI cards / tracker never stack above it.
- Dialog tightened (~640px, denser type/padding); overlay darker (`0.72`) + `blur(10px)` so the page softens behind payment.
- Files: `pay-pfi-panel.tsx`, `pay-pfi-panel.css`.

### 2026-11-06 — Global glowing Pay for this PFI

- When any order is payable, pulsating **Pay for this PFI** available via layout → context. Dashboard hero uses glowing button next to Place an Order. `lib/dealer/pay-pfi.ts` maps oldest payable order.

### 2026-11-06 — Dashboard tracker matches order-tracking steps

- Fixed dashboard active-order progress: horizontal rail with blue checks / yellow current / Pending notes (same as Order Tracking). Header uses truck icon + stage pill. Hardened `.dd .dd__progress*` CSS so styles always apply.

### 2026-11-06 — Pay PFI modal mockup fidelity

- Rebuilt Pay PFI modal to match approved mockup: yellow header rule, two-column amount + breakdown, method cards, bank panel with verified `PFI_BANK_ACCOUNTS`, read-only payment reference + copy, optional your-bank, footer trust + **Continue to bank payment** → confirm step → `paymentAction`.
- Card method shown but unavailable (no gateway). Pulse suppressed while modal open.

### 2026-11-06 — Pay PFI CTA/modal + crumbs + dashboard tracker

- Order tracking (payment stage): pulsating yellow **Pay for this PFI** above tracker; opens Pay PFI modal (existing `paymentAction`).
- Yellow breadcrumb trail on order detail + place/review order (`Orders › …`).
- Dashboard active-order progress restyled to match order-tracking stepper (blue checks, yellow current, connector rail).
- Files: `pay-pfi-panel.tsx|css`, `orders/[id]/page.tsx`, `order-tracking.css`, `place-order-form.tsx`, `dealer-place-order.css`, `dashboard/page.tsx`, `dealer-dashboard.css`.

### 2026-11-06 — Local pdfkit restore for View PFI

- `pdfkit` / `@types/pdfkit` were in package.json but missing from local `node_modules`, so `/api/orders/[id]/pfi` failed with Module not found on localhost (production had the dep). Reinstalled locally.

### 2026-11-06 — Review fuel cards match mockup

- Fixed Review step PMS/AGO containers: solid rounded icon tiles, stacked title/subtitle, large navy volume, right-side translucent watermark (not icons stacked under litres).

### 2026-11-06 — Order Tracking Dashboard redesign (Implementation 07)

- Rebuilt `/dealer/orders/[id]` to match approved Order Tracking mockup: shared forecourt hero, Back to Orders, floating white 7-stage tracker card, light Order Details + Documents columns.
- Preserved `dealerTrackerSteps` status mapping, PFI view link, payment form, find/prev/next nav, and dealer-scoped order fetch. Shared `DealerShell` header untouched.
- Files: `orders/[id]/page.tsx`, `order-tracking.css`, `payment-form.tsx` class hooks.

### 2026-11-06 — Crystal-clear dealer hero banner asset

- Hero banner composed from official `forecourt-sunset.png` (3840×560); settled framing farther zoom + left shift.
- Clarity fix: removed Gaussian blur / heavy seams; export lossless PNG `forecourt-hero-banner-v2.png` + light unsharp; CSS `?v=7`.

### 2026-11-06 — Shared hero photo crop nudge

- Forced identical forecourt crop via shared `dealerHeroPhotoStyle` / CSS tokens (superseded by panoramic swap above).

### 2026-11-06 — Review Fuel Order redesign (Implementation 06)

- Review step UI matches approved mockup: hero copy, wizard done/active states + progression rail, Confirm Order Details (station/delivery tiles, PMS/AGO volume cards, total strip, ready panel, Edit Order Details).
- Same shared hero banner + white Order Summary / What happens next; submission logic unchanged.

### 2026-11-06 — Create Fuel Order redesign (Implementation 05)

- Rebuilt `/dealer/orders/new` to match approved Place Order mockup: cinematic forecourt hero, floating 3-step wizard cards, light Station & Delivery / Fuel Requirements cards, white Order Summary with live EPRA+VAT estimate, What happens next timeline.
- Shared `DealerShell` header untouched (Orders remains active). New CSS: `dealer-place-order.css`; form rewritten in `place-order-form.tsx`; page passes station `code` for pricing.
- Preserved station/date/qty/quick qty, review→submit wizard, `placeOrderAction`, submission key, and validation.

### 2026-11-06 — Shared dealer hero crop + height

- Locked Dashboard, Orders, and legacy `.dp-hero` (order detail) to shared tokens `--dp-hero-height: 280px` and `--dp-hero-photo-position: center 18%` so the canopy Trinitynrg logo is fully visible and heights match.
- Order detail hero image switched to `forecourt-sunset.png` (same as Dashboard/Orders).

### 2026-11-06 — Dealer Portal My Orders redesign (Implementation 04)

- Rebuilt `/dealer/orders`: cinematic forecourt hero, floating category tabs, search/status/date filters, premium yellow-accent table, empty states.
- Shared `DealerShell` header untouched; hero uses `forecourt-sunset.png` (same asset as Dashboard).
- Files: `dealer-orders.css`, `orders-management.tsx`, `orders/page.tsx`; tab labels in `dealer-views.ts` aligned to mockup.
- Real order data/filters preserved (`dealerOrderViewWhere`); View PFI only when a PFI exists.

### 2026-10-13 — Lock trial source-location External IDs per warehouse

- Added `ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS`: PMS LOCAL quant External ID for Eldoret / Nakuru / Kisumu / Lake Oil.
- Local `.env` set `ODOO_MODE=live` for dealer portal quotation trial (not committed).

### 2026-10-13 — Retail Users edit/delete + additional Super Admin

- Active/Pending Users ⋮ menu: Edit (modal) and Delete for `SUPER_ADMIN` sessions.
- New `PATCH`/`DELETE` `/api/retail/users/[id]` (last Super Admin protected; self-delete blocked).
- Script `scripts/ensure-additional-super-admin.ts` (+ `production:ensure:super-admin`) to create another ACTIVE INTERNAL SUPER_ADMIN without emptying the User table.
- Protected Super Admins (`admin@…`, `executive.admin@…`) can only be deleted by `admin@trinityenergyltd.com` (API + UI).

### 2026-10-12 — Dealer portal Messaging matches TRI staff Messaging

- `/dealer/messaging` now uses the same dark 3-column UI as staff (hero, filters, New Chat, contact intelligence, composer).
- `MessagingApp` always renders the staff layout; dealer variant only changes deep-links (`/dealer/orders`, `/dealer/dashboard`).
- Shared `retail-messaging.css` shell (`.rm--dealer`) for station hero + workspace height inside the dealer portal.

### 2026-10-12 — Retail Messaging glassy-blue redesign

- Rebuilt `/intelligence/retail/messaging` as a three-column glassy workspace (conversations / chat / dealer context).
- Cinematic station hero + IntelligenceBackground; search + All/Dealers/Internal/Unread filters.
- Context API loads peer profile, recent dealer orders, and shared PFI/order documents (authorized downloads).
- Preserved Pusher realtime, directory New Chat, send/receipts; dealer portal Messaging now matches staff 3-column dark UI.
- Glass panels: near-transparent fill (~0.14), light blur (6px); chat column widened, contact panel narrowed.
- Messaging + Users: solid Analytics tokens (`#0a192f` canvas, `#122a4a` cards); retail layout suppresses IntelligenceBackground in React (not CSS-only); Messaging hero matches Analytics plane.
- Messaging: staff grid shell transparent so chat/contact gaps show station hero (no navy strip over the image).
- Faster first paint: SSR conversation list (staff + dealer), leaner unread query, parallel context/orders/files; contact panel seeds from list immediately.
- Contact intelligence: removed top station banner; circular station avatar only.
- Contact panel: extra top padding (inline + CSS) so the avatar circle is not clipped by the panel edge; forced overflow visible/auto after stale HMR misses.
- Fix Messaging hydration mismatch: pin time/date formatters to `en-GB` + 24h (`hour12: false`) so SSR and client match.

### 2026-10-12 — Retail Users glassy-blue redesign

- Rebuilt `/intelligence/retail/users` to match premium glass mockup (side-by-side invite cards, Secure Access chip, Pending/Active panels).
- New `retail-users.css`; page canvas locked to Analytics `#0a192f` (same as Messaging).
- Preserved dealer/staff invite APIs; added search + type filter; users API returns `department` + `lastLoginAt`.
- Invite staff watermark silhouettes: moved into header row (top-right), sized ~72×36 so form fields no longer cover them.

### 2026-10-12 — Recent Orders 3-row viewport + Top Stations stretch

- Recent Orders table body fixed to 3-row height (empty or full); rows beyond 3 scroll inside the card.
- Body columns `align-items: stretch`; Top Stations flex-grows so its bottom matches Recent Orders.

### 2026-10-09 — Retail Analytics mockup match (KPI icons + hero scale)

- KPI cards: large solid-color icons on the left; label / value+sparkline / delta stacked beside (mockup layout).
- Hero photo: fixed ~228×52% right plane with soft left/bottom fade (does not stretch with page).
- KPIs sit ~16px under welcome subtitle; sidebar unchanged.

### 2026-10-09 — Retail Analytics layout fix (sidebar + hero clip)

- Reverted wrapping KPIs inside the hero band (that made the photo a full-page background).
- Hero is short (copy-height only); image clipped inside it; opaque cards; sidebar z-index restored.
- KPI row remains tight under the welcome subtitle (~16px gap).

### 2026-10-09 — Retail Analytics hero bleed + dealer canvas

- Retail shell/page canvas switched to dealer portal `#0a192f` (removed mismatched navy).
- Analytics hero: flush top/right soft-bleed (no framed container); dual left+bottom fade; taller scale.
- KPI/body keep 24px gutters; cards use dealer-style glass panels.

### 2026-10-09 — Production dealer portal bootstrap

- Added `scripts/bootstrap-production-dealer.ts` + `production:bootstrap:dealer` (gated like staff bootstrap).
- Creates ACTIVE `DEALER` / `DEALER_ADMIN` with org+station from invite catalog (default Kitanga/MEMISI).
- Staff `SUPER_ADMIN` cannot sign in at `/dealer/login` — dealer portal requires `accountType=DEALER`.
- Updated `run-with-production-env.ts` and `.env.example` docs. Password never logged or committed.

### 2026-10-09 — TRI header search aligned to mockup (right cluster)

- Moved search into a right-aligned `tri-header__actions` group with notifications, user chip, and logout.
- Search is now long (`min ~16rem`, up to ~34rem / 42vw) and sits flush against the right controls with dividers, matching the mockup.

### 2026-10-09 — TRI staff header declutter (match mockup)

- Removed primary/admin nav links from `AppShell` header (Dashboard, Modules, Retail Interface, AI Note Taker, Presentations, Users, Activity).
- Header now: Trinity logo → TRI / Executive Platform → (spacer) → long search → notifications → user chip → logout.
- Module cards / in-page links remain the way to reach modules (navigation not deleted from the product, only from the top bar).

### 2026-10-09 — Local `.env` pointed at Neon production

- Replaced local SQLite `DATABASE_URL` with Neon **production** pooled URL (`ep-quiet-wildflower-zaag2pmh-pooler`).
- Set `DIRECT_URL` to the matching **non-pooler** production host (both URLs pasted by operator were pooler; DIRECT_URL corrected for Prisma).
- **Not committed** (`.env` is gitignored). Caution: `npm run dev` now reads/writes the production database.

### 2026-10-09 — WIP documentation + single local commit

- Added this changelog and Cursor rule to keep documenting and amending one local commit until push.
- Bundled all Odoo External ID mapping work listed above into the first WIP commit on `feature/odoo-external-id-mapping`.
- Fixed `.gitignore`: removed blanket `.env*` that would ignore `.env.example`; kept explicit secret env patterns.

<!-- Add newer entries above this line (newest first under Entry log). -->

---

## 2026-10-09 — Retail Interface + invites + realtime messaging

### Goal
Rebuild Retail Interface as a TRI dark-blue dealer-style workspace with Dashboard / Users / Messaging; station-first dealer invites; portal-specific activation; WhatsApp-like messaging on Neon + Pusher.

### Schema
- Migration `prisma/migrations/20261009140000_retail_messaging_external_ids/`
- `DealerOrganization.odooPartnerExternalId`
- `Station.tradingName`, `odooPartnerExternalId`, `odooStationExternalId`
- Models: `Conversation`, `ConversationParticipant`, `Message`, `MessageReceipt`

### Catalog / Odoo
- `src/lib/dealers/station-invite-catalog.ts` (+ unit tests)
- Live partner resolve prefers External ID (`live-client.ts` + `types.ts` + order sync)

### Retail shell
- Routes under `/intelligence/retail` (dashboard, users, messaging)
- `/intelligence/reports` redirects to retail
- Module launcher href updated

### Invites / activate
- `POST /api/retail/invite/dealer`, `POST /api/retail/invite/staff`
- `/dealer/activate` + improved `/intelligence/activate` (login-grade password UI)
- Middleware allows public dealer activate

### Messaging
- REST under `/api/messaging/*` + Pusher auth/typing
- Shared `MessagingApp` in retail + `/dealer/messaging` nav

### Env
- `.env.example`: Pusher + Resend notes

### Migrate (gated — do not run prod until approved)
1. Staging: `npm run staging:migrate:deploy`
2. Prod only after approval:
   `TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh TRI_ALLOW_PRODUCTION_MIGRATE=1 npm run production:migrate:deploy`


### Production migrate (2026-10-09)
- Applied `20261009140000_retail_messaging_external_ids` to production Neon `ep-quiet-wildflower-zaag2pmh` after operator approval (preflight + status + deploy).
- Staging already had this migration; production schema now matches Retail Interface / messaging models.

### 2026-10-09 — Retail Analytics dashboard mockup match
- Rebuilt `/intelligence/retail` Analytics UI to match TRI dashboard mockup (hero station image, KPI cards + sparklines, order trend, status donut, recent orders table, top stations).
- Sidebar label **Analytics** with gold active border + bar-chart icon.
- Hero asset: `public/assets2/img/retail/dashboard-hero-station.jpg`.

### 2026-10-09 — Retail Analytics spacing fix
- Removed double padding from AppShell `tri-main` (full-bleed retail workspace).
- Tightened hero/KPI/chart vertical rhythm to a single 14px gap; compact KPI padding; seamless hero bleed using Trinity station hero.

### 2026-10-09 — Retail Analytics full-bleed layout fix
- Root cause: `.rad { max-width: 1280px }` + AppShell `tri-main` width cage left empty navy on the right and shrank widgets.
- Added `AppShell fullBleed` / `.tri-main--bleed`; removed content max-width; cards span full content column; larger type/KPI scale; taller seamless hero.

### 2026-10-09 — Retail Analytics mockup layout restructure
- DOM: single locked 2-col body (Trend+Orders | Status+Stations) instead of separate mid/bottom grids.
- Hero: station photo as soft right background bleed (not framed card); 20px gutters; denser KPI/card padding.

### 2026-10-09 — Prisma Neon pool timeout fix
- Cap Prisma pool (`connection_limit`/`pool_timeout`/`pgbouncer`) for Neon pooler; reduce retail dashboard parallel query fan-out.

### 2026-11-06 — Dealer Portal My Orders redesign (Implementation 04)
- Rebuilt `/dealer/orders` to match approved Orders mockup: cinematic forecourt hero, floating category tabs, search/status/date filters, premium yellow-accent table, empty states.
- Shared `DealerShell` header unchanged; Orders nav remains active via existing primary nav.
- New: `src/app/dealer/dealer-orders.css`, `src/components/dealer/orders-management.tsx`; page uses `forecourt-sunset.png` (same as Dashboard).
- Tab labels aligned to mockup (`All Orders`, `Needs Payment`); real data via `dealerOrderViewWhere` / `toDealerOrderRow`; View PFI only when `hasPfi`.
- Follow-up: shared `--dp-hero-height` / `--dp-hero-photo-position` so Dashboard + Orders + order detail match and canopy logo is visible.

### 2026-11-06 — Order Tracking Dashboard redesign (Implementation 07)
- `/dealer/orders/[id]`: floating white 7-stage tracker, light Order Details + Documents; shared hero; header untouched; `order-tracking.css` + page rewrite.

### 2026-11-06 — Create Fuel Order redesign (Implementation 05)
- `/dealer/orders/new`: floating wizard, light form cards, white summary + EPRA/VAT estimate, timeline; `dealer-place-order.css` + rewritten `place-order-form.tsx`.
