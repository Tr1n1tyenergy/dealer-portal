# Multi-station dealer invite — design

Date: 2026-10-13 · Portal: **Admin/Staff → Retail Interface → Users → Invite dealer** · Branch: `feat/multi-station-dealer-invite`

## Goal

Let internal staff invite one dealer login for **several stations of the same dealer company** in a single invite
(e.g. VERECA ENTERPRISES LIMITED → Banana + Nakuru), using the station/partner External IDs from the official dealer catalog (`src/lib/dealers/official-dealers.json`).

## Business rules

1. **A station has at most one dealer.** Already structural: `Station.dealerOrganizationId` is a single required link.
   The invite must never move a station that already belongs to a different dealer company.
2. **A dealer company can have many stations.** Already structural (`DealerOrganization.stations`).
3. **Stations in one invite must belong to the same dealer company** according to the catalog (`orgCode`).
4. **One login per dealer company.** If the company already has a dealer login with status `PENDING` or `ACTIVE`,
   it cannot be invited again (disable that login first to replace the person). `DISABLED` logins do not count.
5. Unchanged: every selected station must be invitable (partner + station External IDs present), and the email
   must not already belong to a user.

No schema change. The dealer portal is unchanged: after activation the login sees all of its company's stations
(the order form already has a station picker).

## Error messages (shown in the form and returned by the API)

| Case | HTTP | Message |
|---|---|---|
| Stations from different dealer companies | 400 | `<A> and <B> belong to separate dealer companies (<Company A>, <Company B>) and can't be linked to one user.` (more than two stations: `These stations belong to separate dealer companies (…) and can't be linked to one user.`) |
| Company already has a login | 409 | `<Company> already has a dealer login (<email>). Disable it before inviting someone else.` |
| Station owned by another company in the database | 409 | `<Station> is already linked to <Other company> and can't be moved to <Company>.` |
| Station not invitable | 400 | existing message (`… not invitable yet — partner and station External IDs are required.`) |
| Unknown station code | 400 | `Unknown station code: <code>.` |
| No station selected | 400 | `Select at least one station.` |
| Email already used | 409 | existing message |

Validation runs **before** the email-configuration check, so these messages also appear on machines without
`RESEND_API_KEY` (today the 503 "Email delivery is not configured" hides them).

## Components

### `src/lib/dealers/dealer-invite.ts` (new)
- `checkStationSelection(rows, codes)` — pure: unknown/non-invitable/mixed-company checks; returns
  `{ ok: true, orgCode, orgName, rows }` or `{ ok: false, status, message }`. Shared by the API and the form so
  both show the identical message.
- `createDealerInvite(input, deps)` — database part of the invite inside one transaction: company-login check,
  station-owner check, upsert company, upsert each station (owner unchanged or new), create the PENDING
  `DEALER_ADMIN` user and invitation token. Email sending stays in the route (existing rollback on failure).

### `src/app/api/retail/invite/dealer/route.ts`
- Body: `{ stationCodes: string[] (min 1), email, firstName, lastName }`.
- Order: auth → parse → `checkStationSelection` → email-config check → `createDealerInvite` → send email →
  activity log (`meta.stationCodes`) → 201 with `stationCodes` and trading names.

### `src/app/api/retail/stations/route.ts`
- Each station gains `orgName` and `hasLogin` (company has a PENDING/ACTIVE dealer login, plus that email).

### `src/components/retail/retail-users-client.tsx`
- Station `<select>` becomes a dropdown with a checkbox per station.
- `hasLogin` and non-invitable stations are disabled with a short reason ("has login", "missing Odoo IDs").
- Any combination of other stations can be ticked; `checkStationSelection` runs on every change and a
  mixed-company selection shows the error under the field and disables "Send dealer invite".
- Summary under the field: `<Company> · <n> stations: <names>`. Server errors show in the existing alert.

## Testing

- Unit (`src/lib/dealers/dealer-invite.test.ts`): mixed companies → message names both stations and companies;
  single and multi-station same-company selections pass; unknown / non-invitable / empty rejected.
- Database (`src/lib/dealers/dealer-invite.db.test.ts`, `npm run test:db`, `tri_test` only): Banana + Nakuru →
  one login, both stations linked to VERECA; second invite for VERECA → 409, no new user; station owned by
  another company → 409 and station unchanged; disabled login does not block.
- Live check on a production build (local `tri_dev` copy, no email key → validation messages visible; success
  path covered by the database tests).

## Out of scope

- Adding a station to an existing login later ("Add station" on the user row) — possible follow-up.
- Per-station logins within one company.
