-- AlterTable
ALTER TABLE "DealerOrder" ADD COLUMN     "submissionKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DealerOrder_submissionKey_key" ON "DealerOrder"("submissionKey");

