import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Archive old tables - NEVER deleted, only renamed.
    -- The _user_person_map table is kept permanently for reference.

    -- Drop remaining FK constraints pointing to users table
    ALTER TABLE pug_players DROP CONSTRAINT IF EXISTS pug_players_user_id_users_id_fk;
    ALTER TABLE pug_players DROP CONSTRAINT IF EXISTS pug_players_invited_by_id_users_id_fk;
    ALTER TABLE users_rels DROP CONSTRAINT IF EXISTS users_rels_parent_fk;
    ALTER TABLE users_rels DROP CONSTRAINT IF EXISTS users_rels_teams_fk;
    ALTER TABLE users_sessions DROP CONSTRAINT IF EXISTS users_sessions_parent_id_fk;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_linked_person_id_people_id_fk;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_avatar_id_media_id_fk;

    -- Drop the linkedPerson FK from invite_links (no longer needed since invite creates a person directly)
    ALTER TABLE invite_links DROP CONSTRAINT IF EXISTS invite_links_linked_person_id_people_id_fk;

    -- Archive tables (rename, not drop)
    ALTER TABLE users RENAME TO _users_archived;
    ALTER TABLE users_rels RENAME TO _users_rels_archived;
    ALTER TABLE users_sessions RENAME TO _users_sessions_archived;
    ALTER TABLE pug_players RENAME TO _pug_players_archived;
    ALTER TABLE pug_players_tiers RENAME TO _pug_players_tiers_archived;
    ALTER TABLE pug_players_approved_roles RENAME TO _pug_players_approved_roles_archived;
    ALTER TABLE pug_players_invite_regions RENAME TO _pug_players_invite_regions_archived;

    -- Remove the pug_leaderboard FK to old pug_players (it now references archived table)
    ALTER TABLE pug_leaderboard DROP CONSTRAINT IF EXISTS pug_leaderboard_player_id_fk;
    -- pug_matches team player FKs
    ALTER TABLE pug_matches_team1_players DROP CONSTRAINT IF EXISTS pug_matches_team1_players_player_id_pug_players_id_fk;
    ALTER TABLE pug_matches_team2_players DROP CONSTRAINT IF EXISTS pug_matches_team2_players_player_id_pug_players_id_fk;
    -- payload_locked_documents FK to pug_players
    ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_pug_players_id_fkey;
  `)

  payload.logger.info('Phase 4 complete: old tables archived (_users_archived, _pug_players_archived)')
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Restore archived tables
    ALTER TABLE _users_archived RENAME TO users;
    ALTER TABLE _users_rels_archived RENAME TO users_rels;
    ALTER TABLE _users_sessions_archived RENAME TO users_sessions;
    ALTER TABLE _pug_players_archived RENAME TO pug_players;
    ALTER TABLE _pug_players_tiers_archived RENAME TO pug_players_tiers;
    ALTER TABLE _pug_players_approved_roles_archived RENAME TO pug_players_approved_roles;
    ALTER TABLE _pug_players_invite_regions_archived RENAME TO pug_players_invite_regions;
  `)
}
