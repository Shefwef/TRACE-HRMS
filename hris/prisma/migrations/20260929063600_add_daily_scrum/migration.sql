-- CreateEnum
CREATE TYPE "DailyScrumStatus" AS ENUM ('ON_TRACK', 'ATTENTION_NEEDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DailyTaskType" AS ENUM ('TODAY', 'COMPLETED');

-- AlterTable
ALTER TABLE "system_settings" ALTER COLUMN "senderName" SET DEFAULT 'TRACE HRMS';

-- CreateTable
CREATE TABLE "daily_scrum_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "DailyScrumStatus" NOT NULL DEFAULT 'ON_TRACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_scrum_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" "DailyTaskType" NOT NULL,
    "text" TEXT NOT NULL,
    "deadline" DATE,
    "isDecision" BOOLEAN NOT NULL DEFAULT false,
    "decisionNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_scrum_entries_date_idx" ON "daily_scrum_entries"("date");

-- CreateIndex
CREATE INDEX "daily_scrum_entries_employeeId_idx" ON "daily_scrum_entries"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_scrum_entries_date_employeeId_key" ON "daily_scrum_entries"("date", "employeeId");

-- CreateIndex
CREATE INDEX "daily_tasks_entryId_idx" ON "daily_tasks"("entryId");

-- AddForeignKey
ALTER TABLE "daily_scrum_entries" ADD CONSTRAINT "daily_scrum_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "daily_scrum_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
