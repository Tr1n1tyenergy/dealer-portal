-- Staff Member Home: access requests (Ask an Admin) and ticked action items.
-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'GRANTED', 'DECLINED');

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "modules" TEXT NOT NULL,
    "note" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItemDone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteSessionId" TEXT NOT NULL,
    "itemHash" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItemDone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_requesterId_idx" ON "AccessRequest"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItemDone_userId_noteSessionId_itemHash_key" ON "ActionItemDone"("userId", "noteSessionId", "itemHash");

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItemDone" ADD CONSTRAINT "ActionItemDone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItemDone" ADD CONSTRAINT "ActionItemDone_noteSessionId_fkey" FOREIGN KEY ("noteSessionId") REFERENCES "NoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

