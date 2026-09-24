-- Team voice handback: where each player was moved in from, and the clock
-- the voice sweep runs on. Additive; safe to apply before the deploy.
ALTER TABLE pug_lobbies
  ADD COLUMN IF NOT EXISTS "voiceOrigins" JSONB,
  ADD COLUMN IF NOT EXISTS "voiceStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "voiceEndedAt" TIMESTAMPTZ;
