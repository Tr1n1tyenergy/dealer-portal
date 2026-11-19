-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'MPESA_CODE', 'MPESA_PROMPT');

-- AlterTable
ALTER TABLE "PaymentRecord" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "claimKey" TEXT,
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "mpesaCode" TEXT,
ADD COLUMN     "odooError" TEXT,
ADD COLUMN     "odooPaymentId" INTEGER,
ADD COLUMN     "odooState" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_claimKey_key" ON "PaymentRecord"("claimKey");

