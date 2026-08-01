-- CreateEnum
CREATE TYPE "JobResult" AS ENUM ('SUCCESS', 'FAILURE', 'SKIPPED');

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "result" "JobResult" NOT NULL,
    "summary" TEXT,
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_job_startedAt_idx" ON "job_runs"("job", "startedAt");

-- CreateIndex
CREATE INDEX "job_runs_job_result_finishedAt_idx" ON "job_runs"("job", "result", "finishedAt");
