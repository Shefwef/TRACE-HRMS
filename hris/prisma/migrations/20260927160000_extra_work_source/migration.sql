-- CreateEnum
CREATE TYPE "ExtraWorkSource" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "extra_work_logs"
  ADD COLUMN "source" "ExtraWorkSource" NOT NULL DEFAULT 'MANUAL';

-- Backfill: any log whose reason mentions "auto-detected" was created by the
-- biometric pipeline (maybeAutoFileReplacementLeave) - promote it to AUTO.
UPDATE "extra_work_logs"
  SET "source" = 'AUTO'
  WHERE "reason" ILIKE '%auto-detected%';
