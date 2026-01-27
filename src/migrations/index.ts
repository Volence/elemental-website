import * as migration_20251217_055734 from "./20251217_055734";
import * as migration_20251218_130100 from "./20251218_130100";
import * as migration_20251222_190839_add_recruitment_collections from "./20251222_190839_add_recruitment_collections";
import * as migration_20251229_150200_add_complete_status from "./20251229_150200_add_complete_status";
import * as migration_20260113_201500_add_quick_scrims from "./20260113_201500_add_quick_scrims";
import * as migration_20260114_021700_add_scouting_wiki_phase1 from "./20260114_021700_add_scouting_wiki_phase1";
import * as migration_20260127_153700_add_flexible_team_fields from "./20260127_153700_add_flexible_team_fields";

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
];
