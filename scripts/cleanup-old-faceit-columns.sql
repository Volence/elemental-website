-- ============================================================================
-- Cleanup Script for Old FACEIT Columns
-- ============================================================================
-- This removes old/refactored columns that are no longer used in the codebase.
-- Run this AFTER you've verified the data isn't needed.
--
-- To execute:
-- docker compose exec postgres psql -U payload -d payload -f /home/node/app/scripts/cleanup-old-faceit-columns.sql
--
-- Or from host:
-- docker compose exec postgres psql -U payload -d payload < scripts/cleanup-old-faceit-columns.sql
-- ============================================================================

BEGIN;

-- Tournament Templates - Old FACEIT fields
ALTER TABLE tournament_templates 
  DROP COLUMN IF EXISTS is_faceit_tournament,
  DROP COLUMN IF EXISTS faceit_championship_id,
  DROP COLUMN IF EXISTS faceit_stage_id,
  DROP COLUMN IF EXISTS faceit_auto_sync,
  DROP COLUMN IF EXISTS faceit_league_id;

-- Social Media Settings - Old weekly goals fields
ALTER TABLE social_media_settings 
  DROP COLUMN IF EXISTS weekly_goals_total_posts_per_week,
  DROP COLUMN IF EXISTS weekly_goals_match_promos,
  DROP COLUMN IF EXISTS weekly_goals_stream_announcements,
  DROP COLUMN IF EXISTS weekly_goals_community_engagement,
  DROP COLUMN IF EXISTS weekly_goals_original_content,
  DROP COLUMN IF EXISTS content_guidelines;

-- Teams - Old field name (refactored to faceitTeamId)
ALTER TABLE teams 
  DROP COLUMN IF EXISTS faceit_league_team_id;

-- Payload Locked Documents Relations - Old references
ALTER TABLE payload_locked_documents_rels 
  DROP COLUMN IF EXISTS refinement_id,
  DROP COLUMN IF EXISTS faceit_seasons_archive_id;

-- FaceIt Seasons - Old stat tracking fields
ALTER TABLE faceit_seasons 
  DROP COLUMN IF EXISTS faceit_league_team_id,
  DROP COLUMN IF EXISTS rank,
  DROP COLUMN IF EXISTS wins,
  DROP COLUMN IF EXISTS losses,
  DROP COLUMN IF EXISTS points,
  DROP COLUMN IF EXISTS matches_played,
  DROP COLUMN IF EXISTS manual_clear_history;

-- Matches - Old FACEIT sync fields
ALTER TABLE matches 
  DROP COLUMN IF EXISTS generate_slug,
  DROP COLUMN IF EXISTS faceit_opponent_team_id,
  DROP COLUMN IF EXISTS faceit_opponent_team_name,
  DROP COLUMN IF EXISTS faceit_synced;

COMMIT;

-- Verify the cleanup
\dt+ tournament_templates
\dt+ social_media_settings
\dt+ teams
\dt+ faceit_seasons
\dt+ matches

-- Success message
SELECT 'Old FACEIT columns successfully removed!' AS status;

