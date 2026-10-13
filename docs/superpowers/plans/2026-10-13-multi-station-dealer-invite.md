# Multi-station Dealer Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One dealer invite can cover several stations of the same Odoo dealer company, with clear errors when the selection breaks a rule.

**Architecture:** A pure selection checker (shared by the form and the API, so both show identical messages) plus a server-only invite service that does the database work in one transaction. The route orders validation before the email-configuration check. The form swaps the station `<select>` for a checkbox dropdown.

**Tech Stack:** Next.js 15 route handlers, Prisma 6 / PostgreSQL, React client component, `node:test` + tsx.

**Spec:** `docs/superpowers/specs/2026-10-13-multi-station-dealer-invite-design.md`

## Global Constraints

- No schema change, no migration.
- One login per dealer company: a company "has a login" when a `DEALER` user with status `PENDING` or `ACTIVE` belongs to it; `DISABLED` does not count.
- A station already linked to a different company is never moved.
- Messages, verbatim from the spec:
  - two stations, different companies: `` `${a} and ${b} belong to separate dealer companies (${companyA}, ${companyB}) and can't be linked to one user.` ``
  - more than two, mixed: `` `These stations belong to separate dealer companies (${companies.join(", ")}) and can't be linked to one user.` ``
  - company has a login (409): `` `${company} already has a dealer login (${email}). Disable it before inviting someone else.` ``
  - station owned elsewhere (409): `` `${station} is already linked to ${otherCompany} and can't be moved to ${company}.` ``
  - unknown code (400): `` `Unknown station code: ${code}.` ``
  - none selected (400): `Select at least one station.`
  - not invitable (400): existing text `` `Station "${name}" is not invitable yet — partner and station External IDs are required.` ``
- Deviation from the spec (file layout only): the pure checker lives in `src/lib/dealers/station-selection.ts` (client-safe, no Prisma import); the database part lives in `src/lib/dealers/dealer-invite.ts`. The client cannot import a module that imports Prisma.
- Portal: Admin/Staff only. Dealer portal unchanged.

## Review Focus

1. The same station code sent twice (`["banana","banana"]`) → treated as one station, not an error and not two links. Test in Task 1.
2. Two staff invite the same company at the same moment with different emails → exactly one login is created; the other gets the 409. Test in Task 2 (upsert the company row first inside the transaction so the second invite waits on its row lock, then check logins).
3. A refused invite must leave the database untouched (no new company, no station link, no user). Test in Task 2.
4. Email typed with capitals/spaces (`" Owner@Vereca.co.ke "`) → stored lowercased and trimmed, and the "already exists" check uses the same form. Test in Task 2.
5. A company whose only login is `DISABLED` can be invited again. Test in Task 2.

---

### Task 1: Station selection checker

**Files:**
- Create: `src/lib/dealers/station-selection.ts`
- Test: `src/lib/dealers/station-selection.test.ts`
- Modify: `package.json` (add the test file to `"test"`)

**Interfaces:**
- Produces:
  - `type StationSelectionRow = { stationCode: string; stationName: string; orgCode: string; orgName: string; invitable: boolean }`
  - `type SelectionResult<T> = { ok: true; orgCode: string; orgName: string; rows: T[] } | { ok: false; status: 400; message: string }`
  - `checkStationSelection<T extends StationSelectionRow>(rows: T[], codes: string[]): SelectionResult<T>` — dedupes `codes`, keeps the order of first appearance; checks in order: empty → unknown → mixed companies → not invitable.

- [ ] **Step 1: Write the failing tests** (use small inline rows: banana/nakuru → `VERECA`/`VERECA ENTERPRISES LIMITED`, kiserian → `TULLA`/`TULLA NAGELLE ENERGY AND COURIOR SERVICES LIMITED`, kambiti → `invitable: false`)
  - `accepts two stations of the same company` → `ok`, `orgCode === "VERECA"`, `rows.map(r => r.stationCode)` deep-equals `["banana","nakuru"]`
  - `accepts a single station`
  - `treats a repeated station as one` → `["banana","banana"]` gives one row
  - `rejects stations of different companies` → message equals `"Banana and Kiserian belong to separate dealer companies (VERECA ENTERPRISES LIMITED, TULLA NAGELLE ENERGY AND COURIOR SERVICES LIMITED) and can't be linked to one user."`
  - `rejects a mixed selection of three` → message starts with `"These stations belong to separate dealer companies ("`
  - `rejects an empty selection` → `"Select at least one station."`
  - `rejects an unknown code` → `"Unknown station code: nowhere."`
  - `rejects a station without Odoo IDs` → message contains `not invitable yet`

- [ ] **Step 2: Run to verify they fail**
  Run: `node --import tsx --test src/lib/dealers/station-selection.test.ts`
  Expected: FAIL (module not found)

- [ ] **Step 3: Implement `checkStationSelection` in `src/lib/dealers/station-selection.ts`**
  No imports from Prisma, the catalog JSON or server code. Company names in the two-station message follow the order of the selected stations.

- [ ] **Step 4: Run to verify they pass**, then add the file to the `"test"` script and run `npm test` (all pass).

- [ ] **Step 5: Commit** — `feat(retail): station selection rules for dealer invites`

### Task 2: Invite service (database)

**Files:**
- Create: `src/lib/dealers/dealer-invite.ts`
- Test: `src/lib/dealers/dealer-invite.db.test.ts` (same `_test` database guard and fixture/cleanup style as `src/lib/orders/depot-access.db.test.ts`)
- Modify: `package.json` (add the test file to `"test:db"`)

**Interfaces:**
- Consumes: `StationSelectionRow`, `checkStationSelection` (Task 1); `StationInviteCatalogRow` from `src/lib/dealers/station-invite-catalog.ts` (structurally satisfies `StationSelectionRow`).
- Produces:
  - `findCompanyLogins(orgCodes: string[]): Promise<Map<string, string>>` — orgCode → email of its `PENDING`/`ACTIVE` `DEALER` user.
  - `findInviteConflict(input: { orgCode: string; orgName: string; rows: StationInviteCatalogRow[]; email: string }): Promise<{ status: 409; message: string } | null>` — read-only: email exists → existing "A user with this email already exists."; company has a login; a station linked to another company. `createDealerInvite` runs the same checks again inside its transaction (shared private helper taking the transaction client).
  - `createDealerInvite(input: { orgCode: string; orgName: string; rows: StationInviteCatalogRow[]; email: string; firstName: string; lastName: string }): Promise<{ ok: true; user: { id: string; email: string; firstName: string; lastName: string; status: string }; token: string } | { ok: false; status: 409; message: string }>`
    One `prisma.$transaction`, in this order: email-exists check (lowercased/trimmed email) → upsert company by `code` (same fields as today's route) → company-login check → for each row: if a station with that `code` exists under a different company, fail with the "already linked" message; else upsert it with today's fields → create the `PENDING` `DEALER_ADMIN` user (`department: "Dealer"`, `permissions: "[]"`) → create `invitationToken` (`generateSecureToken()`, `daysFromNow(7)`). A failure returns `{ ok: false, … }` by throwing inside the transaction and catching outside, so nothing is written.

- [ ] **Step 1: Write the failing tests** (fixtures: two catalog-shaped rows for a unique test company `VERECA-<run>` with codes `banana-<run>`/`nakuru-<run>`, plus a second company and station for the "owned elsewhere" case)
  - `creates one login linked to both stations` → one user with that `dealerOrganizationId`; both stations' `dealerOrganizationId` equal the company id; one invitation token
  - `refuses a second login for the same company` → `status 409`, message `"<orgName> already has a dealer login (<first email>). Disable it before inviting someone else."`; user count for the company stays 1
  - `refuses a station linked to another company and changes nothing` → `status 409`, "already linked" message; that station's owner unchanged; no user with the new email
  - `allows a new invite when the only login is disabled`
  - `stores the email lowercased and trimmed`
  - `creates only one login when two invites for the same company race` → `Promise.allSettled` of two calls with different emails; exactly one `ok: true`, one 409; company user count 1
  - `findCompanyLogins reports the company's pending login email`
  - `findInviteConflict reports the existing login without writing anything`

- [ ] **Step 2: Run to verify they fail**
  Run: `node --env-file-if-exists=.env.test.local --import tsx --test src/lib/dealers/dealer-invite.db.test.ts`
  Expected: FAIL (module not found)

- [ ] **Step 3: Implement `findCompanyLogins`, `findInviteConflict` and `createDealerInvite` in `src/lib/dealers/dealer-invite.ts`**

- [ ] **Step 4: Run to verify they pass**, then add the file to `"test:db"` and run `npm run test:db` (all pass). Prove the race test: temporarily move the company-login check before the company upsert, confirm that test fails, restore.

- [ ] **Step 5: Commit** — `feat(retail): invite service links one dealer login to several stations`

### Task 3: API routes

**Files:**
- Modify: `src/app/api/retail/invite/dealer/route.ts`
- Modify: `src/app/api/retail/stations/route.ts`

**Interfaces:**
- Consumes: `checkStationSelection` (Task 1), `findInviteConflict`, `createDealerInvite`, `findCompanyLogins` (Task 2), `listStationInviteCatalog` (existing).
- Produces:
  - `POST /api/retail/invite/dealer` body `{ stationCodes: string[]; email; firstName; lastName }` (zod: `stationCodes: z.array(z.string().min(1)).min(1)`); errors as `{ error: string }` with the spec's status codes; 201 body `user` gains `stationCodes: string[]` and `tradingNames: string[]` (replacing `stationCode`/`tradingName`).
  - `GET /api/retail/stations` rows gain `orgName: string`, `hasLogin: boolean`, `loginEmail: string | null`.

- [ ] **Step 1: Rewrite the invite route** in this order: `requireInternalApi` → parse → `checkStationSelection(listStationInviteCatalog(), stationCodes)` → `findInviteConflict` (409) → `emailDeliveryConfigured()` (503, existing text) → `createDealerInvite` → send email (existing rollback: delete token + user on failure) → `logActivity` with `meta: { email, stationCodes }` → 201. An empty `stationCodes` reaches `checkStationSelection` (zod `.min(1)` failure maps to `"Select at least one station."`).
- [ ] **Step 2: Extend the stations route** with `orgName`, and `hasLogin`/`loginEmail` from one `findCompanyLogins(distinct orgCodes)` call.
- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm test` and `npm run test:db` pass.
- [ ] **Step 4: Commit** — `feat(retail): dealer invite API accepts several stations of one company`

### Task 4: Invite form

**Files:**
- Modify: `src/components/retail/retail-users-client.tsx` (state at ~line 97, `inviteDealer` ~line 132, station field ~lines 250-268)
- Modify: `src/app/intelligence/retail/retail-users.css` (checkbox dropdown styles, `ru-` prefix, existing colours)

**Interfaces:**
- Consumes: `checkStationSelection`, `StationSelectionRow` (Task 1); stations API fields (Task 3).

- [ ] **Step 1: State and submit** — `stationCode: string` becomes `stationCodes: string[]`; `StationOpt` gains `orgCode`, `orgName`, `hasLogin`, `loginEmail`; submit sends `stationCodes`; after success clear the selection.
- [ ] **Step 2: Station field** — a button showing `Select stations…` / the ticked names, opening a list with one checkbox per station (all stations, sorted as the API returns them). Disabled with a reason: `hasLogin` → `has login`, `!invitable` → `missing Odoo IDs`. Closes on outside click and Escape; keyboard reachable (button + native checkboxes).
- [ ] **Step 3: Live feedback** — on every change run `checkStationSelection(stations, stationCodes)`: when `ok`, show `${orgName} · ${n} station(s): ${names}` under the field; when not ok (and at least one ticked), show the message under the field in the existing error style and disable "Send dealer invite". Header subtitle becomes `Send an invitation to a dealer for one or more of their stations.`
- [ ] **Step 4: Verify** — `npx tsc --noEmit`, `npm run lint` (no new warnings), `npm run build` succeed.
- [ ] **Step 5: Commit** — `feat(retail): pick several stations in the dealer invite form`

### Task 5: End-to-end check

- [ ] **Step 1:** Production build of the branch in the scratch copy against a `pg_dump` copy of `tri_dev` (port 3995); no `RESEND_API_KEY`, so no email leaves the machine.
- [ ] **Step 2:** HTTP probe as Super Admin: Banana + Kiserian → 400 with the exact two-station message; unknown code → 400; a company that already has a login (seeded Vereca dealer) → 409 with its message; dealer and depot logins → 403; stations list carries `orgName`/`hasLogin`.
- [ ] **Step 3:** User checks the form in a browser (http://localhost:3995/intelligence/retail/users): ticking Banana + Kiserian shows the message and disables the button; Banana + Nakuru shows the Vereca summary; greyed stations show their reason.
- [ ] **Step 4:** Clean up (stop server by port PID, drop the probe database); full `npm test`, `npm run test:db`, build green; give the push and PR commands.
