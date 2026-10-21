#!/usr/bin/env tsx
/**
 * Create (or update password for) an additional ACTIVE INTERNAL SUPER_ADMIN.
 * Unlike bootstrap-production-admin, this allows existing users.
 *
 * Local / current DATABASE_URL:
 *   BOOTSTRAP_ADMIN_EMAIL='second@trinityenergyltd.com' \
 *   BOOTSTRAP_ADMIN_PASSWORD='...' \
 *   BOOTSTRAP_ADMIN_FIRST_NAME='...' \
 *   BOOTSTRAP_ADMIN_LAST_NAME='...' \
 *     npx tsx scripts/ensure-additional-super-admin.ts
 *
 * Production (.env.production.local):
 *   TRI_CONFIRM_PRODUCTION_ENDPOINT=ep-quiet-wildflower-zaag2pmh \
 *   TRI_ALLOW_PRODUCTION_BOOTSTRAP=1 \
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \
 *     npx tsx scripts/run-with-production-env.ts npx tsx scripts/ensure-additional-super-admin.ts
 *
 * Never logs the password.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { validatePasswordStrength } from "../src/lib/security/password-policy";

function dbUrl() {
  const raw = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!raw) throw new Error("DATABASE_URL (or DIRECT_URL) is required.");
  return raw;
}

async function main() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const firstName = (process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "Super").trim() || "Super";
  const lastName = (process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "Admin").trim() || "Admin";
  const department = (process.env.BOOTSTRAP_ADMIN_DEPARTMENT ?? "Executive").trim() || "Executive";

  if (!email || !email.includes("@")) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required.");
  }
  const strength = validatePasswordStrength(password);
  if (!strength.ok) throw new Error(strength.message);

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          department,
          passwordHash,
          passwordChangedAt: new Date(),
          role: "SUPER_ADMIN",
          accountType: "INTERNAL",
          status: "ACTIVE",
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
      console.info(
        `[ensure-super-admin] Updated existing user ${email} → ACTIVE INTERNAL SUPER_ADMIN (password reset; value not logged).`
      );
      return;
    }

    await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        department,
        passwordHash,
        role: "SUPER_ADMIN",
        accountType: "INTERNAL",
        status: "ACTIVE",
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
    console.info(
      `[ensure-super-admin] Created ACTIVE INTERNAL SUPER_ADMIN for ${email} (password not logged).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[ensure-super-admin] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
