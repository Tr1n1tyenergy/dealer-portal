-- CreateEnum
CREATE TYPE "SupportTicketOrigin" AS ENUM ('DEALER', 'INTERNAL');

-- AlterEnum
ALTER TYPE "SupportTicketDepartment" ADD VALUE 'OPERATIONS';

-- AlterEnum
ALTER TYPE "SupportTicketStatus" ADD VALUE 'RESOLVED';

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "origin" "SupportTicketOrigin" NOT NULL DEFAULT 'DEALER',
ALTER COLUMN "dealerOrganizationId" DROP NOT NULL;
