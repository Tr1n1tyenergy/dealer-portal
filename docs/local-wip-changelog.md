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
| `src/app/intelligence/retail/retail-messaging.css` | Messaging page hero shell |
| `src/app/api/messaging/conversations/[id]/context/route.ts` | Peer + orders + files context |
| `src/app/api/messaging/files/**` | Authorized order/PFI file download |

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
