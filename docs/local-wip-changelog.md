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

