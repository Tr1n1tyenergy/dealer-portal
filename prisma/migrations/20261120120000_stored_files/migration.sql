-- CreateTable (IF NOT EXISTS: the never-merged redesign branch created the same table on some databases)
CREATE TABLE IF NOT EXISTS "StoredFile" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("key")
);
