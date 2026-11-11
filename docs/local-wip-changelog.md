# Local WIP changelog (unpushed)

**Purpose:** Document local codebase changes that are **not yet pushed** to GitHub (`Tr1n1tyenergy/dealer-portal`).  
**Workflow:** Update this file whenever we change local code. Keep everything on the same local feature commit until we explicitly push.

**Branch (intended):** `feature/odoo-external-id-mapping`  
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
