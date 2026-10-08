import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  OFFICIAL_DEALERS,
  UNASSIGNED_STATIONS,
} from "../src/lib/dealers/registry";
import {
  NEON_PRODUCTION_ENDPOINT_ID,
  endpointIdFromUrl,
} from "../scripts/neon-endpoints";

const prisma = new PrismaClient();

function assertSeedAllowedAgainstCurrentDatabase() {
  const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  for (const url of urls) {
    const ep = endpointIdFromUrl(url);
    if (ep === NEON_PRODUCTION_ENDPOINT_ID) {
      throw new Error(
        `Refusing prisma/seed.ts against production endpoint ${NEON_PRODUCTION_ENDPOINT_ID}. ` +
          "Use scripts/bootstrap-production-admin.ts for the first SUPER_ADMIN only."
      );
    }
  }
  if (process.env.TRI_ALLOW_PRODUCTION_SEED === "1") {
    throw new Error(
      "TRI_ALLOW_PRODUCTION_SEED is not supported. Demo seeding must never target production."
    );
  }

  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD must be set explicitly for seed (no silent default in this environment)."
    );
  }
  if (password === "TrinityAdmin2026!") {
    throw new Error(
      "Refusing default SUPER_ADMIN_PASSWORD. Choose a unique password for local/staging seed."
    );
  }
}

async function seedOfficialDealers(defaultPassword: string) {
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const credentials: Array<{
    dealer: string;
    email: string;
    password: string;
    stations: string;
    products: string;
  }> = [];

  for (const dealer of OFFICIAL_DEALERS) {
    const org = await prisma.dealerOrganization.upsert({
      where: { code: dealer.code },
      update: {
        name: dealer.name,
        odooPartnerId: dealer.odooPartnerId,
        products: JSON.stringify(
          dealer.stations[0]?.products ?? ["PMS", "AGO", "LUBRICANTS", "LPG"]
        ),
      },
      create: {
        code: dealer.code,
        name: dealer.name,
        odooPartnerId: dealer.odooPartnerId,
        products: JSON.stringify(
          dealer.stations[0]?.products ?? ["PMS", "AGO", "LUBRICANTS", "LPG"]
        ),
      },
    });

    for (const station of dealer.stations) {
      const existing = await prisma.station.findUnique({ where: { code: station.code } });
      if (existing) {
        await prisma.station.update({
          where: { code: station.code },
          data: {
            name: station.name,
            dealerOrganizationId: org.id,
            odooPartnerId: station.odooPartnerId,
            products: JSON.stringify(station.products),
          },
        });
      } else {
        await prisma.station.create({
          data: {
            code: station.code,
            name: station.name,
            dealerOrganizationId: org.id,
            odooPartnerId: station.odooPartnerId,
            products: JSON.stringify(station.products),
          },
        });
      }
    }

    await prisma.user.upsert({
      where: { email: dealer.login.email.toLowerCase() },
      update: {
        firstName: dealer.login.firstName,
        lastName: dealer.login.lastName,
        passwordHash,
        accountType: "DEALER",
        role: "DEALER_ADMIN",
        status: "ACTIVE",
        department: "Dealer",
        dealerOrganizationId: org.id,
      },
      create: {
        email: dealer.login.email.toLowerCase(),
        firstName: dealer.login.firstName,
        lastName: dealer.login.lastName,
        passwordHash,
        department: "Dealer",
        role: "DEALER_ADMIN",
        accountType: "DEALER",
        status: "ACTIVE",
        dealerOrganizationId: org.id,
      },
    });

    credentials.push({
      dealer: dealer.name,
      email: dealer.login.email.toLowerCase(),
      password: defaultPassword,
      stations: dealer.stations
        .map((s) => `${s.name} (partner ${s.odooPartnerId ?? "—"})`)
        .join(", "),
      products: (dealer.stations[0]?.products ?? []).join("/"),
    });
  }

  console.log("\n── Official dealer logins ──");
  console.log(
    `Assigned dealers: ${OFFICIAL_DEALERS.length} | Unassigned stations (no login yet): ${UNASSIGNED_STATIONS.map((s) => `${s.name} (${s.reason})`).join(", ")}`
  );
  for (const row of credentials) {
    console.log(
      `  ${row.email}  |  ${row.password}  |  ${row.stations}  |  ${row.products}  |  ${row.dealer}`
    );
  }
  console.log("────────────────────────────\n");
}

async function main() {
  assertSeedAllowedAgainstCurrentDatabase();

  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@trinityenergyltd.com").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD!;
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? "Super";
  const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? "Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      passwordHash,
      role: "SUPER_ADMIN",
      accountType: "INTERNAL",
      status: "ACTIVE",
      department: "Executive",
      permissions: JSON.stringify([
        "users",
        "reports",
        "note-taker",
        "presentations",
        "settings",
        "activity",
      ]),
    },
    create: {
      email,
      firstName,
      lastName,
      passwordHash,
      role: "SUPER_ADMIN",
      accountType: "INTERNAL",
      status: "ACTIVE",
      department: "Executive",
      permissions: JSON.stringify([
        "users",
        "reports",
        "note-taker",
        "presentations",
        "settings",
        "activity",
      ]),
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: "platform.name" },
    update: { value: "Trinity Retail Intelligence" },
    create: { key: "platform.name", value: "Trinity Retail Intelligence" },
  });

  console.log("Seeded Super Admin:", admin.email);

  const depot = await prisma.depot.upsert({
    where: { code: "NBI-DEPOT" },
    update: { name: "Nairobi Depot" },
    create: { code: "NBI-DEPOT", name: "Nairobi Depot" },
  });

  const dealer = await prisma.dealerOrganization.upsert({
    where: { code: "ABC" },
    update: { name: "ABC Dealers Ltd" },
    create: { code: "ABC", name: "ABC Dealers Ltd" },
  });

  await prisma.station.upsert({
    where: { id: "seed-westlands" },
    update: { name: "Trinity Westlands", dealerOrganizationId: dealer.id, code: "demo-westlands" },
    create: {
      id: "seed-westlands",
      code: "demo-westlands",
      name: "Trinity Westlands",
      dealerOrganizationId: dealer.id,
    },
  });
  await prisma.station.upsert({
    where: { id: "seed-nakuru" },
    update: { name: "Trinity Nakuru", dealerOrganizationId: dealer.id, code: "demo-nakuru" },
    create: {
      id: "seed-nakuru",
      code: "demo-nakuru",
      name: "Trinity Nakuru",
      dealerOrganizationId: dealer.id,
    },
  });

  const dealerPassword = await bcrypt.hash(process.env.DEALER_PASSWORD ?? "DealerDemo2026!", 12);
  const depotPassword = await bcrypt.hash(process.env.DEPOT_PASSWORD ?? "DepotDemo2026!", 12);

  await prisma.user.upsert({
    where: { email: "dealer@abcdealers.example" },
    update: {
      passwordHash: dealerPassword,
      accountType: "DEALER",
      role: "DEALER_ADMIN",
      status: "ACTIVE",
      dealerOrganizationId: dealer.id,
    },
    create: {
      email: "dealer@abcdealers.example",
      firstName: "Amina",
      lastName: "Kamau",
      passwordHash: dealerPassword,
      department: "Dealer",
      role: "DEALER_ADMIN",
      accountType: "DEALER",
      status: "ACTIVE",
      dealerOrganizationId: dealer.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "depot@trinityenergyltd.com" },
    update: {
      passwordHash: depotPassword,
      accountType: "DEPOT",
      role: "DEPOT_MANAGER",
      status: "ACTIVE",
      depotId: depot.id,
    },
    create: {
      email: "depot@trinityenergyltd.com",
      firstName: "David",
      lastName: "Otieno",
      passwordHash: depotPassword,
      department: "Depot",
      role: "DEPOT_MANAGER",
      accountType: "DEPOT",
      status: "ACTIVE",
      depotId: depot.id,
    },
  });

  console.log("Seeded dealer portal and depot demo accounts.");

  const officialDefaultPassword =
    process.env.DEALER_DEFAULT_PASSWORD ?? "TrinityDealer2026!";
  await seedOfficialDealers(officialDefaultPassword);

  const dealerUser = await prisma.user.findUniqueOrThrow({
    where: { email: "dealer@abcdealers.example" },
  });

  const demoOrders: Array<{
    id: string;
    reference: string;
    stationId: string;
    status: "QUOTATION_CREATING" | "PFI_ISSUED" | "AWAITING_PAYMENT" | "IN_TRANSIT" | "DELIVERED";
    pms: number;
    ago: number;
    daysAgo: number;
  }> = [
    {
      id: "seed-order-qp",
      reference: "TRI-D-2026-0001",
      stationId: "seed-westlands",
      status: "QUOTATION_CREATING",
      pms: 20000,
      ago: 10000,
      daysAgo: 1,
    },
    {
      id: "seed-order-pfi",
      reference: "TRI-D-2026-0002",
      stationId: "seed-nakuru",
      status: "PFI_ISSUED",
      pms: 15000,
      ago: 8000,
      daysAgo: 2,
    },
    {
      id: "seed-order-pay",
      reference: "TRI-D-2026-0003",
      stationId: "seed-westlands",
      status: "AWAITING_PAYMENT",
      pms: 25000,
      ago: 12000,
      daysAgo: 3,
    },
    {
      id: "seed-order-transit",
      reference: "TRI-D-2026-0004",
      stationId: "seed-nakuru",
      status: "IN_TRANSIT",
      pms: 18000,
      ago: 9000,
      daysAgo: 4,
    },
    {
      id: "seed-order-delivered",
      reference: "TRI-D-2026-0005",
      stationId: "seed-westlands",
      status: "DELIVERED",
      pms: 22000,
      ago: 11000,
      daysAgo: 6,
    },
  ];

  for (const demo of demoOrders) {
    const createdAt = new Date(Date.now() - demo.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.dealerOrder.upsert({
      where: { id: demo.id },
      update: {
        status: demo.status,
        stationId: demo.stationId,
        dealerOrganizationId: dealer.id,
      },
      create: {
        id: demo.id,
        reference: demo.reference,
        dealerOrganizationId: dealer.id,
        stationId: demo.stationId,
        createdById: dealerUser.id,
        status: demo.status,
        odooSyncKey: `seed-${demo.id}`,
        createdAt,
        updatedAt: createdAt,
        lines: {
          create: [
            { product: "PMS", quantityLitres: demo.pms },
            { product: "AGO", quantityLitres: demo.ago },
          ],
        },
      },
    });
  }

  console.log("Seeded demo dealer orders for dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
