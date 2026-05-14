-- Create pug_queue_entries table for auto-queue system
CREATE TABLE "pug_queue_entries" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tier" "pug_tier" NOT NULL,
    "region" TEXT,
    "roles" "pug_role"[],
    "payloadSeasonId" INTEGER NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pug_queue_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pug_queue_entries_userId_tier_key" ON "pug_queue_entries"("userId", "tier");
CREATE INDEX "pug_queue_entries_tier_region_idx" ON "pug_queue_entries"("tier", "region");
