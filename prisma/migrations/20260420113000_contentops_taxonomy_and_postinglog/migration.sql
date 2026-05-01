ALTER TABLE "Post" ADD COLUMN "machineFamily" TEXT;
ALTER TABLE "Post" ADD COLUMN "machineModel" TEXT;

UPDATE "Post"
SET "machineFamily" = COALESCE(NULLIF("machine", ''), 'Other')
WHERE "machineFamily" IS NULL;

ALTER TABLE "Post" ALTER COLUMN "machineFamily" SET NOT NULL;

ALTER TABLE "PostingLog" ADD COLUMN "postedBy" TEXT;

DELETE FROM "PostingLog" a
USING "PostingLog" b
WHERE a.id > b.id
  AND a."postId" = b."postId"
  AND a.platform = b.platform;

CREATE UNIQUE INDEX "PostingLog_postId_platform_key" ON "PostingLog"("postId", "platform");