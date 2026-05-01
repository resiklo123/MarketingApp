ALTER TABLE "Post" ADD COLUMN "slug" TEXT;

UPDATE "Post"
SET "slug" = CONCAT('post-', LOWER(SUBSTRING("id" FROM GREATEST(LENGTH("id") - 5, 1))))
WHERE "slug" IS NULL;

ALTER TABLE "Post" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

ALTER TABLE "PostingLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "MachineModelOption" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineModelOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MachineModelOption_family_model_key" ON "MachineModelOption"("family", "model");