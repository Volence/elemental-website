-- Add region column to pug_lobbies for invite-tier regional separation
ALTER TABLE "pug_lobbies" ADD COLUMN "region" TEXT;
