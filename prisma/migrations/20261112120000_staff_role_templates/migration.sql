-- Named permission templates for staff invites (Create Role UI).
CREATE TABLE "StaffRoleTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "baseRole" "Role" NOT NULL DEFAULT 'STANDARD_USER',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRoleTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffRoleTemplate_name_key" ON "StaffRoleTemplate"("name");
CREATE INDEX "StaffRoleTemplate_createdAt_idx" ON "StaffRoleTemplate"("createdAt");
