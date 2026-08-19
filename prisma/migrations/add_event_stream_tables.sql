-- Ingest the optional DKEEH event streams (damage / healing / ability uses).
-- Previously parsed then dropped; these are the raw material for future
-- heatmap and win-probability features.
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block;
-- run this file with psql (autocommit per statement), not wrapped in BEGIN.

ALTER TYPE scrim_event_type ADD VALUE IF NOT EXISTS 'ability_1_used';
ALTER TYPE scrim_event_type ADD VALUE IF NOT EXISTS 'ability_2_used';
ALTER TYPE scrim_event_type ADD VALUE IF NOT EXISTS 'damage';
ALTER TYPE scrim_event_type ADD VALUE IF NOT EXISTS 'healing';

CREATE TABLE IF NOT EXISTS scrim_damage_events (
    id               serial PRIMARY KEY,
    "scrimId"        integer NOT NULL,
    event_type       scrim_event_type NOT NULL DEFAULT 'damage',
    match_time       double precision NOT NULL,
    attacker_team    text NOT NULL,
    attacker_name    text NOT NULL,
    attacker_hero    text NOT NULL,
    victim_team      text NOT NULL,
    victim_name      text NOT NULL,
    victim_hero      text NOT NULL,
    event_ability    text NOT NULL,
    event_damage     double precision NOT NULL,
    is_critical_hit  text NOT NULL,
    is_environmental text NOT NULL,
    "mapDataId"      integer REFERENCES scrim_map_data(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "scrim_damage_events_scrimId_idx" ON scrim_damage_events("scrimId");
CREATE INDEX IF NOT EXISTS "scrim_damage_events_mapDataId_idx" ON scrim_damage_events("mapDataId");

CREATE TABLE IF NOT EXISTS scrim_healing_events (
    id             serial PRIMARY KEY,
    "scrimId"      integer NOT NULL,
    event_type     scrim_event_type NOT NULL DEFAULT 'healing',
    match_time     double precision NOT NULL,
    healer_team    text NOT NULL,
    healer_name    text NOT NULL,
    healer_hero    text NOT NULL,
    healee_team    text NOT NULL,
    healee_name    text NOT NULL,
    healee_hero    text NOT NULL,
    event_ability  text NOT NULL,
    event_healing  double precision NOT NULL,
    is_health_pack text NOT NULL,
    "mapDataId"    integer REFERENCES scrim_map_data(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "scrim_healing_events_scrimId_idx" ON scrim_healing_events("scrimId");
CREATE INDEX IF NOT EXISTS "scrim_healing_events_mapDataId_idx" ON scrim_healing_events("mapDataId");

CREATE TABLE IF NOT EXISTS scrim_ability_uses (
    id              serial PRIMARY KEY,
    "scrimId"       integer NOT NULL,
    event_type      scrim_event_type NOT NULL DEFAULT 'ability_1_used',
    ability_number  integer NOT NULL,
    match_time      double precision NOT NULL,
    player_team     text NOT NULL,
    player_name     text NOT NULL,
    player_hero     text NOT NULL,
    hero_duplicated text NOT NULL,
    "mapDataId"     integer REFERENCES scrim_map_data(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "scrim_ability_uses_scrimId_idx" ON scrim_ability_uses("scrimId");
CREATE INDEX IF NOT EXISTS "scrim_ability_uses_mapDataId_idx" ON scrim_ability_uses("mapDataId");
