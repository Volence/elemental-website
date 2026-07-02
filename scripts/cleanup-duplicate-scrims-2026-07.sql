-- Cleanup for duplicate scrim uploads found 2026-07-02 (run on prod after approval):
--   ssh ubuntu@elmt.gg
--   docker exec -i elemental-website-postgres-1 psql -U payload -d payload < this-file.sql
--
-- Case 1: scrims 12 ("Bug vs. Fighting", team Bug) and 13 ("Fighting vs. Bug",
--   team Fighting) are the SAME six logs uploaded once per team, predating the
--   dual-team upload feature. Their player mappings are complementary (12 has
--   Bug players mapped, 13 has Fighting players). Merge 13's mappings into 12,
--   link Fighting as the second team, delete 13.
--
-- Case 2: scrim 26 ("Reality VS", Apr 14) shares three maps with the later
--   scrims 31/32 (Apr 29 re-uploads): Aatlis (87 kills) = map 163 in scrim 31,
--   Colosseo (48) = map 167 and Dorado (90) = map 168 in scrim 32. Keep the
--   originals in scrim 26 (correct date attribution), delete the re-uploads.
--   Scrim 31 keeps 3 maps, scrim 32 keeps 3 maps. No player mappings affected
--   (none of these maps have personIds).

BEGIN;

-- ── Case 1, step 1: copy Fighting's personId mappings from scrim 13 into
-- scrim 12's rows (fills NULLs only; identical logs match 1:1 on
-- map name + round + player + hero) ──
UPDATE scrim_player_stats ps12
SET "personId" = src."personId"
FROM scrim_map_data md12,
     scrim_maps m12,
     (
       SELECT m13.name AS map_name, ps13.player_name, ps13.round_number,
              ps13.player_hero, ps13."personId"
       FROM scrim_player_stats ps13
       JOIN scrim_map_data md13 ON md13.id = ps13."mapDataId"
       JOIN scrim_maps m13 ON m13.id = md13."mapId"
       WHERE m13."scrimId" = 13 AND ps13."personId" IS NOT NULL
     ) src
WHERE ps12."mapDataId" = md12.id
  AND md12."mapId" = m12.id
  AND m12."scrimId" = 12
  AND m12.name = src.map_name
  AND ps12.player_name = src.player_name
  AND ps12.round_number = src.round_number
  AND ps12.player_hero = src.player_hero
  AND ps12."personId" IS NULL;

-- ── Case 1, step 2: make scrim 12 the canonical dual-team scrim ──
UPDATE scrim_scrims
SET "payloadTeamId2" = 71, name = 'Bug vs. Fighting'
WHERE id = 12;

-- ── Case 1, step 3: delete the duplicate scrim (cascades to maps/events) ──
DELETE FROM scrim_scrims WHERE id = 13;

-- ── Case 2: delete the three re-uploaded maps (cascades to their events) ──
DELETE FROM scrim_maps WHERE id IN (163, 167, 168);

-- ── Bonus: null out the 666 kill positions corrupted by the vector-string
-- parsing bug (x is NaN and unrecoverable; y/z alone are useless and NaN
-- poisons the replay viewer's bounding box) ──
UPDATE scrim_kills
SET attacker_x = NULL, attacker_y = NULL, attacker_z = NULL,
    victim_x = NULL, victim_y = NULL, victim_z = NULL
WHERE attacker_x = 'NaN'::float8;

-- Sanity: expect scrim 12 with 6 maps + teamId2=71; scrims 31/32 with 3 maps each; no scrim 13
SELECT s.id, s.name, s."payloadTeamId", s."payloadTeamId2",
       (SELECT count(*) FROM scrim_maps m WHERE m."scrimId" = s.id) AS maps
FROM scrim_scrims s WHERE s.id IN (12, 13, 26, 31, 32) ORDER BY s.id;

COMMIT;
