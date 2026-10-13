import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { StationInviteCatalogRow } from "./station-invite-catalog";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "dealer invite links one login to several stations of one company",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let invites: typeof import("./dealer-invite");
    const run = `i${Date.now()}`;
    let sequence = 0;

    function company() {
      sequence += 1;
      const orgCode = `CO-${run}-${sequence}`;
      const orgName = `TEST COMPANY ${run} ${sequence}`;
      const row = (station: string): StationInviteCatalogRow => ({
        stationCode: `${station}-${run}-${sequence}`,
        stationName: `${station} ${sequence}`,
        tradingName: `${orgName}-${station}`,
        orgCode,
        orgName,
        odooPartnerId: 5000 + sequence,
        odooPartnerExternalId: `__export__.res_partner_test_${run}_${sequence}_${station}`,
        odooStationExternalId: `__export__.account_analytic_account_test_${run}_${sequence}_${station}`,
        products: ["PMS", "AGO"],
        invitable: true,
      });
      return { orgCode, orgName, rows: [row("banana"), row("nakuru")] };
    }

    function invite(co: ReturnType<typeof company>, email: string, rows = co.rows) {
      return invites.createDealerInvite({
        orgCode: co.orgCode,
        orgName: co.orgName,
        rows,
        email,
        firstName: "Test",
        lastName: "Dealer",
      });
    }

    const email = (name: string) => `${name}.${run}@example.test`;

    async function usersOf(orgCode: string) {
      return prisma.user.findMany({ where: { dealerOrganization: { code: orgCode } } });
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      invites = await import("./dealer-invite");
    });

    after(async () => {
      const orgs = await prisma.dealerOrganization.findMany({ where: { code: { startsWith: `CO-${run}-` } } });
      const ids = orgs.map((o) => o.id);
      await prisma.user.deleteMany({ where: { email: { endsWith: `.${run}@example.test` } } });
      await prisma.station.deleteMany({ where: { dealerOrganizationId: { in: ids } } });
      await prisma.dealerOrganization.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    });

    it("creates one login linked to both stations", async () => {
      const co = company();

      const result = await invite(co, email("both"));

      assert.equal(result.ok, true);
      const users = await usersOf(co.orgCode);
      assert.equal(users.length, 1);
      assert.equal(users[0].status, "PENDING");
      assert.equal(users[0].accountType, "DEALER");
      const stations = await prisma.station.findMany({
        where: { code: { in: co.rows.map((r) => r.stationCode) } },
      });
      assert.equal(stations.length, 2);
      assert.ok(stations.every((s) => s.dealerOrganizationId === users[0].dealerOrganizationId));
      assert.equal(await prisma.invitationToken.count({ where: { userId: users[0].id } }), 1);
    });

    it("refuses a second login for the same company", async () => {
      const co = company();
      await invite(co, email("first"));

      const result = await invite(co, email("second"));

      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.status, 409);
      assert.equal(
        result.message,
        `${co.orgName} already has a dealer login (${email("first")}). Disable it before inviting someone else.`
      );
      assert.equal((await usersOf(co.orgCode)).length, 1);
    });

    it("refuses a station linked to another company and changes nothing", async () => {
      const owner = company();
      await invite(owner, email("owner"), [owner.rows[0]]);
      const intruder = company();
      const stolen = { ...owner.rows[0], orgCode: intruder.orgCode, orgName: intruder.orgName };

      const result = await invite(intruder, email("intruder"), [stolen]);

      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.status, 409);
      assert.equal(
        result.message,
        `${stolen.stationName} is already linked to ${owner.orgName} and can't be moved to ${intruder.orgName}.`
      );
      const station = await prisma.station.findUniqueOrThrow({
        where: { code: stolen.stationCode },
        include: { dealerOrganization: true },
      });
      assert.equal(station.dealerOrganization.code, owner.orgCode);
      assert.equal(await prisma.user.count({ where: { email: email("intruder") } }), 0);
      assert.equal(await prisma.dealerOrganization.count({ where: { code: intruder.orgCode } }), 0);
    });

    it("allows a new invite when the only login is disabled", async () => {
      const co = company();
      await invite(co, email("old"));
      await prisma.user.update({ where: { email: email("old") }, data: { status: "DISABLED" } });

      const result = await invite(co, email("new"));

      assert.equal(result.ok, true);
    });

    it("stores the email lowercased and trimmed", async () => {
      const co = company();

      const result = await invite(co, `  Mixed.Case.${run}@Example.Test `);

      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.user.email, `mixed.case.${run}@example.test`);
    });

    it("creates only one login when two invites for the same company race", async () => {
      const co = company();

      const results = await Promise.allSettled([invite(co, email("race-a")), invite(co, email("race-b"))]);

      const outcomes = results.map((r) => (r.status === "fulfilled" ? r.value.ok : "threw"));
      assert.equal(outcomes.filter((o) => o === true).length, 1, `outcomes: ${outcomes}`);
      assert.equal((await usersOf(co.orgCode)).length, 1);
    });

    it("findCompanyLogins reports the company's pending login email", async () => {
      const co = company();
      await invite(co, email("listed"));

      const logins = await invites.findCompanyLogins([co.orgCode]);

      assert.equal(logins.get(co.orgCode), email("listed"));
    });

    it("findInviteConflict reports the existing login without writing anything", async () => {
      const co = company();
      await invite(co, email("holder"));
      const before = await prisma.user.count();

      const conflict = await invites.findInviteConflict({
        orgCode: co.orgCode,
        orgName: co.orgName,
        rows: co.rows,
        email: email("other"),
      });

      assert.equal(conflict?.status, 409);
      assert.match(conflict?.message ?? "", /already has a dealer login/);
      assert.equal(await prisma.user.count(), before);
    });
  }
);
