-- CreateEnum
CREATE TYPE "DailyTaskStatus" AS ENUM ('IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "DailyTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "daily_tasks" ADD COLUMN     "priority" "DailyTaskPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "status" "DailyTaskStatus" NOT NULL DEFAULT 'IN_PROGRESS';
