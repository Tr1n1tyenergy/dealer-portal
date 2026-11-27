-- Paid orders are booked, sent to KRA, then held for the depot. New labels cannot be inserted in this same transaction.
ALTER TYPE "DealerOrderStatus" ADD VALUE IF NOT EXISTS 'ORDER_BOOKED';
ALTER TYPE "DealerOrderStatus" ADD VALUE IF NOT EXISTS 'WAITING_KRA_INVOICE';
ALTER TYPE "DealerOrderStatus" ADD VALUE IF NOT EXISTS 'KRA_INVOICE_RECEIVED';
ALTER TYPE "DealerOrderStatus" ADD VALUE IF NOT EXISTS 'DEPOT_DOCS_RECEIVED';

ALTER TABLE "DealerOrder" ADD COLUMN IF NOT EXISTS "odooInvoiceId" INTEGER;
ALTER TABLE "DealerOrder" ADD COLUMN IF NOT EXISTS "odooInvoiceNumber" TEXT;
ALTER TABLE "DealerOrder" ADD COLUMN IF NOT EXISTS "odooPickingId" INTEGER;
ALTER TABLE "DealerOrder" ADD COLUMN IF NOT EXISTS "etimsInvoiceNumber" TEXT;
ALTER TABLE "DealerOrder" ADD COLUMN IF NOT EXISTS "etimsReceiptNumber" TEXT;
ALTER TABLE "DealerOrder" ADD COLUMN IF NOT EXISTS "fulfillmentError" TEXT;
