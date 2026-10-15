-- Three staff roles (Admin, Sales Person Executive, Staff Member). Finance and Sales Rep users
-- become Standard User (Staff Member) first, so nobody gains access, then the enum is recreated.
UPDATE "User" SET "role" = 'STANDARD_USER' WHERE "role" IN ('FINANCE', 'SALES_REP');
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'SALES_PERSON_EXECUTIVE', 'STANDARD_USER', 'DEPOT_MANAGER', 'DEALER_ADMIN', 'DEALER_USER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STANDARD_USER';
DROP TYPE "Role_old";
