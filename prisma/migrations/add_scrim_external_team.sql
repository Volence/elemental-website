-- Coach uploads for teams outside the org: free-text team name on the scrim.
-- Mutually exclusive with payloadTeamId; visibility scoped by creatorEmail.
ALTER TABLE scrim_scrims ADD COLUMN IF NOT EXISTS "externalTeamName" text;
CREATE INDEX IF NOT EXISTS "scrim_scrims_externalTeamName_idx" ON scrim_scrims("externalTeamName");

-- Payload People departments checkbox backing column (manual - Payload migrations disabled)
ALTER TABLE people ADD COLUMN IF NOT EXISTS departments_can_upload_external_scrims boolean DEFAULT false;
