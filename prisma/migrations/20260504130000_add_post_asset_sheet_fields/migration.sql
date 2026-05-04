-- DEPLOYMENT NOTE: Run `npm run prisma:deploy` after applying the Supabase SQL
-- quick-fix (IF NOT EXISTS guards above make this safe even if columns were
-- added manually). Both this migration and 20260502120000 must be recorded in
-- _prisma_migrations before the next `prisma migrate dev` run.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
