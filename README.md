# Trinity Retail Intelligence (TRI)

Enterprise retail intelligence and dealer operations platform for Trinity Energy Kenya.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion
- **Auth:** NextAuth (credentials) — invite-only, no public registration
- **Database:** Prisma + SQLite (local) / PostgreSQL-ready for production
- **Email:** Resend (falls back to console + invite URL in development)
- **ERP:** Odoo 17 JSON-RPC (quotations / PFI PDF)

## Quick start

```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you land on the **Access Gateway** (`/access`).

### Seeded accounts

Configured via `.env` (defaults):

- Super Admin: `admin@trinityenergyltd.com` / `TrinityAdmin2026!`
- Demo dealer: `dealer@abcdealers.example` / `DealerDemo2026!`
- Official dealers: `dealer.*@trinityenergyltd.com` / `TrinityDealer2026!`

Change these before any real deployment.

## Portals

| Route | Purpose |
| --- | --- |
| `/access` | Access gateway (staff / dealer / depot) |
| `/intelligence/*` | Trinity staff (reports, note-taker, presentations, admin) |
| `/dealer/*` | Dealer portal (orders, PFI, payments, tracking) |
| `/depot/*` | Depot & operations |

## Production notes

1. Set a strong `NEXTAUTH_SECRET`
2. Point `DATABASE_URL` at PostgreSQL and update `prisma/schema.prisma` provider to `postgresql`
3. Configure `RESEND_API_KEY` + `EMAIL_FROM` for invitation / reset emails
4. Set `ODOO_MODE=live` with credentials when ready for live quotations
