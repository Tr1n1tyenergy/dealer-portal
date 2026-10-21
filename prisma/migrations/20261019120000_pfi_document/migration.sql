-- AlterTable
ALTER TABLE "DealerOrder" ADD COLUMN     "quotedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DealerOrderLine" ADD COLUMN     "unitPriceExVat" TEXT;

-- AlterTable
ALTER TABLE "ProFormaInvoice" ADD COLUMN     "approvedByName" TEXT,
ADD COLUMN     "preparedByName" TEXT,
ADD COLUMN     "subtotal" TEXT,
ADD COLUMN     "vatAmount" TEXT,
ADD COLUMN     "vatRate" TEXT;

