-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INTERNAL', 'DEALER', 'DEPOT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'STANDARD_USER', 'SALES_REP', 'FINANCE', 'DEPOT_MANAGER', 'DEALER_ADMIN', 'DEALER_USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COUNTDOWN', 'RECORDING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "NotesStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('FUEL_RETAIL', 'NON_FUEL_RETAIL', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProductCode" AS ENUM ('PMS', 'AGO', 'LUBRICANTS', 'LPG');

-- CreateEnum
CREATE TYPE "DealerOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ODOO_SYNC_PENDING', 'ODOO_SYNC_FAILED', 'QUOTATION_CREATING', 'QUOTATION_READY', 'PFI_PENDING', 'PFI_ISSUED', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFICATION', 'PAYMENT_CONFIRMED', 'RELEASED_TO_DEPOT', 'LOADING', 'LOADED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'REQUIRES_AMENDMENT', 'REJECTED', 'CANCELLED', 'PAYMENT_EXCEPTION', 'STOCK_EXCEPTION', 'DELIVERY_EXCEPTION');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('SUBMITTED', 'VERIFICATION', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "department" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STANDARD_USER',
    "accountType" "AccountType" NOT NULL DEFAULT 'INTERNAL',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "dealerOrganizationId" TEXT,
    "depotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "timeLimitSeconds" INTEGER,
    "participants" TEXT NOT NULL DEFAULT '[]',
    "audioUrl" TEXT,
    "transcript" TEXT,
    "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "notesStatus" "NotesStatus" NOT NULL DEFAULT 'PENDING',
    "notesJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteSessionId" TEXT,
    "slidesJson" TEXT NOT NULL,
    "presenter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "contentJson" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "odooPartnerId" INTEGER,
    "products" TEXT NOT NULL DEFAULT '["PMS","AGO","LUBRICANTS","LPG"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "dealerOrganizationId" TEXT NOT NULL,
    "odooPartnerId" INTEGER,
    "products" TEXT NOT NULL DEFAULT '["PMS","AGO","LUBRICANTS","LPG"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Depot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "DealerOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dealerOrganizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "depotId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "DealerOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedDeliveryDate" TIMESTAMP(3),
    "dealerReference" TEXT,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "amountDue" TEXT,
    "odooSyncKey" TEXT NOT NULL,
    "odooQuotationId" TEXT,
    "odooQuotationNumber" TEXT,
    "odooSyncError" TEXT,
    "truckRegistration" TEXT,
    "driverName" TEXT,
    "transporter" TEXT,
    "loadedPmsLitres" INTEGER,
    "loadedAgoLitres" INTEGER,
    "loadingReference" TEXT,
    "loadingStartedAt" TIMESTAMP(3),
    "loadingCompletedAt" TIMESTAMP(3),
    "sealNumbers" TEXT,
    "deliveryNoteRef" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "quantityLitres" INTEGER NOT NULL,

    CONSTRAINT "DealerOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProFormaInvoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odooDocumentId" TEXT,
    "documentPath" TEXT,

    CONSTRAINT "ProFormaInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "bankReference" TEXT,
    "transactionReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "proofPath" TEXT,
    "status" "PaymentState" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDocument" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_accountType_idx" ON "User"("accountType");

-- CreateIndex
CREATE INDEX "User_dealerOrganizationId_idx" ON "User"("dealerOrganizationId");

-- CreateIndex
CREATE INDEX "User_depotId_idx" ON "User"("depotId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationToken_token_key" ON "InvitationToken"("token");

-- CreateIndex
CREATE INDEX "InvitationToken_token_idx" ON "InvitationToken"("token");

-- CreateIndex
CREATE INDEX "InvitationToken_userId_idx" ON "InvitationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "NoteSession_userId_idx" ON "NoteSession"("userId");

-- CreateIndex
CREATE INDEX "NoteSession_status_idx" ON "NoteSession"("status");

-- CreateIndex
CREATE INDEX "NoteSession_createdAt_idx" ON "NoteSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Presentation_noteSessionId_key" ON "Presentation"("noteSessionId");

-- CreateIndex
CREATE INDEX "Presentation_userId_idx" ON "Presentation"("userId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "Report"("userId");

-- CreateIndex
CREATE INDEX "Report_category_idx" ON "Report"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DealerOrganization_code_key" ON "DealerOrganization"("code");

-- CreateIndex
CREATE INDEX "DealerOrganization_name_idx" ON "DealerOrganization"("name");

-- CreateIndex
CREATE INDEX "DealerOrganization_odooPartnerId_idx" ON "DealerOrganization"("odooPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Station_code_key" ON "Station"("code");

-- CreateIndex
CREATE INDEX "Station_dealerOrganizationId_idx" ON "Station"("dealerOrganizationId");

-- CreateIndex
CREATE INDEX "Station_odooPartnerId_idx" ON "Station"("odooPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Depot_code_key" ON "Depot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DealerOrder_reference_key" ON "DealerOrder"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "DealerOrder_odooSyncKey_key" ON "DealerOrder"("odooSyncKey");

-- CreateIndex
CREATE INDEX "DealerOrder_dealerOrganizationId_idx" ON "DealerOrder"("dealerOrganizationId");

-- CreateIndex
CREATE INDEX "DealerOrder_stationId_idx" ON "DealerOrder"("stationId");

-- CreateIndex
CREATE INDEX "DealerOrder_depotId_idx" ON "DealerOrder"("depotId");

-- CreateIndex
CREATE INDEX "DealerOrder_status_idx" ON "DealerOrder"("status");

-- CreateIndex
CREATE INDEX "DealerOrder_createdAt_idx" ON "DealerOrder"("createdAt");

-- CreateIndex
CREATE INDEX "DealerOrder_odooQuotationId_idx" ON "DealerOrder"("odooQuotationId");

-- CreateIndex
CREATE INDEX "DealerOrderLine_orderId_idx" ON "DealerOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProFormaInvoice_orderId_key" ON "ProFormaInvoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProFormaInvoice_number_key" ON "ProFormaInvoice"("number");

-- CreateIndex
CREATE INDEX "ProFormaInvoice_number_idx" ON "ProFormaInvoice"("number");

-- CreateIndex
CREATE INDEX "PaymentRecord_orderId_idx" ON "PaymentRecord"("orderId");

-- CreateIndex
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_createdAt_idx" ON "OrderStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "OrderDocument_orderId_idx" ON "OrderDocument"("orderId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_dealerOrganizationId_fkey" FOREIGN KEY ("dealerOrganizationId") REFERENCES "DealerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationToken" ADD CONSTRAINT "InvitationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteSession" ADD CONSTRAINT "NoteSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_noteSessionId_fkey" FOREIGN KEY ("noteSessionId") REFERENCES "NoteSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_dealerOrganizationId_fkey" FOREIGN KEY ("dealerOrganizationId") REFERENCES "DealerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerOrder" ADD CONSTRAINT "DealerOrder_dealerOrganizationId_fkey" FOREIGN KEY ("dealerOrganizationId") REFERENCES "DealerOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerOrder" ADD CONSTRAINT "DealerOrder_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerOrder" ADD CONSTRAINT "DealerOrder_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerOrder" ADD CONSTRAINT "DealerOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerOrderLine" ADD CONSTRAINT "DealerOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProFormaInvoice" ADD CONSTRAINT "ProFormaInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

