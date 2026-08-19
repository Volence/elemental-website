-- Persist the uploader's "which side is yours" answer on the scrim.
-- Previously sent by the upload UI but discarded by the server, leaving
-- side resolution entirely dependent on person mappings hitting a roster.
ALTER TABLE scrim_scrims ADD COLUMN IF NOT EXISTS "ourSideRaw" text;
