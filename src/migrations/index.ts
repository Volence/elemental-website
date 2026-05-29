import * as migration_20251217_055734 from "./20251217_055734";
import * as migration_20251218_130100 from "./20251218_130100";
import * as migration_20251222_190839_add_recruitment_collections from "./20251222_190839_add_recruitment_collections";
import * as migration_20251229_150200_add_complete_status from "./20251229_150200_add_complete_status";
import * as migration_20260113_201500_add_quick_scrims from "./20260113_201500_add_quick_scrims";
import * as migration_20260114_021700_add_scouting_wiki_phase1 from "./20260114_021700_add_scouting_wiki_phase1";
import * as migration_20260127_153700_add_flexible_team_fields from "./20260127_153700_add_flexible_team_fields";
import * as migration_20260207_235400_add_team_branding_colors from "./20260207_235400_add_team_branding_colors";
import * as migration_20260302_073000_migrate_themecolor_to_branding from "./20260302_073000_migrate_themecolor_to_branding";
import * as migration_20260322_add_new_regions from "./20260322_add_new_regions";
import * as migration_20260323_add_reschedule_detection from "./20260323_add_reschedule_detection";
import * as migration_20260411_add_reschedule_channels from "./20260411_add_reschedule_channels";
import * as migration_20260425_add_pug_seasons from "./20260425_add_pug_seasons";
import * as migration_20260425_add_pug_players from "./20260425_add_pug_players";
import * as migration_20260425_add_pug_matches from "./20260425_add_pug_matches";
import * as migration_20260425_add_pug_leaderboard from "./20260425_add_pug_leaderboard";
import * as migration_20260426_move_pug_offense_count from "./20260426_move_pug_offense_count";
import * as migration_20260426_add_pug_admin_to_users from "./20260426_add_pug_admin_to_users";
import * as migration_20260426_fix_pug_players_join_table_ids from "./20260426_fix_pug_players_join_table_ids";
import * as migration_20260427_add_pug_season_map_pool from "./20260427_add_pug_season_map_pool";
import * as migration_20260502_add_pug_season_queue_status from "./20260502_add_pug_season_queue_status";
import * as migration_20260502_add_missing_pug_schema from "./20260502_add_missing_pug_schema";
import * as migration_20260506_phase0_user_person_mapping from "./20260506_phase0_user_person_mapping";
import * as migration_20260506_phase1_add_auth_fields_to_people from "./20260506_phase1_add_auth_fields_to_people";
import * as migration_20260506_phase2_migrate_user_data_to_people from "./20260506_phase2_migrate_user_data_to_people";
import * as migration_20260506_phase3_remap_fk_references from "./20260506_phase3_remap_fk_references";
import * as migration_20260506_phase4_archive_old_tables from "./20260506_phase4_archive_old_tables";
import * as migration_20260529_add_last_schedule_role from "./20260529_add_last_schedule_role";

export const migrations = [
  {
    up: migration_20251217_055734.up,
    down: migration_20251217_055734.down,
    name: "20251217_055734"
  },
  {
    up: migration_20251218_130100.up,
    down: migration_20251218_130100.down,
    name: "20251218_130100",
  },
  {
    up: migration_20251222_190839_add_recruitment_collections.up,
    down: migration_20251222_190839_add_recruitment_collections.down,
    name: "20251222_190839_add_recruitment_collections",
  },
  {
    up: migration_20251229_150200_add_complete_status.up,
    down: migration_20251229_150200_add_complete_status.down,
    name: "20251229_150200_add_complete_status",
  },
  {
    up: migration_20260113_201500_add_quick_scrims.up,
    down: migration_20260113_201500_add_quick_scrims.down,
    name: "20260113_201500_add_quick_scrims",
  },
  {
    up: migration_20260114_021700_add_scouting_wiki_phase1.up,
    down: migration_20260114_021700_add_scouting_wiki_phase1.down,
    name: "20260114_021700_add_scouting_wiki_phase1",
  },
  {
    up: migration_20260127_153700_add_flexible_team_fields.up,
    down: migration_20260127_153700_add_flexible_team_fields.down,
    name: "20260127_153700_add_flexible_team_fields",
  },
  {
    up: migration_20260207_235400_add_team_branding_colors.up,
    down: migration_20260207_235400_add_team_branding_colors.down,
    name: "20260207_235400_add_team_branding_colors",
  },
  {
    up: migration_20260302_073000_migrate_themecolor_to_branding.up,
    down: migration_20260302_073000_migrate_themecolor_to_branding.down,
    name: "20260302_073000_migrate_themecolor_to_branding",
  },
  {
    up: migration_20260322_add_new_regions.up,
    down: migration_20260322_add_new_regions.down,
    name: "20260322_add_new_regions",
  },
  {
    up: migration_20260323_add_reschedule_detection.up,
    down: migration_20260323_add_reschedule_detection.down,
    name: "20260323_add_reschedule_detection",
  },
  {
    up: migration_20260411_add_reschedule_channels.up,
    down: migration_20260411_add_reschedule_channels.down,
    name: "20260411_add_reschedule_channels",
  },
  {
    up: migration_20260425_add_pug_seasons.up,
    down: migration_20260425_add_pug_seasons.down,
    name: "20260425_add_pug_seasons",
  },
  {
    up: migration_20260425_add_pug_players.up,
    down: migration_20260425_add_pug_players.down,
    name: "20260425_add_pug_players",
  },
  {
    up: migration_20260425_add_pug_matches.up,
    down: migration_20260425_add_pug_matches.down,
    name: "20260425_add_pug_matches",
  },
  {
    up: migration_20260425_add_pug_leaderboard.up,
    down: migration_20260425_add_pug_leaderboard.down,
    name: "20260425_add_pug_leaderboard",
  },
  {
    up: migration_20260426_move_pug_offense_count.up,
    down: migration_20260426_move_pug_offense_count.down,
    name: "20260426_move_pug_offense_count",
  },
  {
    up: migration_20260426_add_pug_admin_to_users.up,
    down: migration_20260426_add_pug_admin_to_users.down,
    name: "20260426_add_pug_admin_to_users",
  },
  {
    up: migration_20260426_fix_pug_players_join_table_ids.up,
    down: migration_20260426_fix_pug_players_join_table_ids.down,
    name: "20260426_fix_pug_players_join_table_ids",
  },
  {
    up: migration_20260427_add_pug_season_map_pool.up,
    down: migration_20260427_add_pug_season_map_pool.down,
    name: "20260427_add_pug_season_map_pool",
  },
  {
    up: migration_20260502_add_pug_season_queue_status.up,
    down: migration_20260502_add_pug_season_queue_status.down,
    name: "20260502_add_pug_season_queue_status",
  },
  {
    up: migration_20260502_add_missing_pug_schema.up,
    down: migration_20260502_add_missing_pug_schema.down,
    name: "20260502_add_missing_pug_schema",
  },
  {
    up: migration_20260506_phase0_user_person_mapping.up,
    down: migration_20260506_phase0_user_person_mapping.down,
    name: "20260506_phase0_user_person_mapping",
  },
  {
    up: migration_20260506_phase1_add_auth_fields_to_people.up,
    down: migration_20260506_phase1_add_auth_fields_to_people.down,
    name: "20260506_phase1_add_auth_fields_to_people",
  },
  {
    up: migration_20260506_phase2_migrate_user_data_to_people.up,
    down: migration_20260506_phase2_migrate_user_data_to_people.down,
    name: "20260506_phase2_migrate_user_data_to_people",
  },
  {
    up: migration_20260506_phase3_remap_fk_references.up,
    down: migration_20260506_phase3_remap_fk_references.down,
    name: "20260506_phase3_remap_fk_references",
  },
  {
    up: migration_20260506_phase4_archive_old_tables.up,
    down: migration_20260506_phase4_archive_old_tables.down,
    name: "20260506_phase4_archive_old_tables",
  },
  {
    up: migration_20260529_add_last_schedule_role.up,
    down: migration_20260529_add_last_schedule_role.down,
    name: "20260529_add_last_schedule_role",
  },
];
