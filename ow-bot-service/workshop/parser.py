import logging
import re

log = logging.getLogger("ow-bot.workshop.parser")

TIMESTAMP_RE = re.compile(r"^\[[\d:]+\]\s*")

HEADERS: dict[str, list[str]] = {
    "ability_1_used": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated",
    ],
    "ability_2_used": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated",
    ],
    "damage": [
        "event_type", "match_time", "attacker_team", "attacker_name",
        "attacker_hero", "victim_team", "victim_name", "victim_hero",
        "event_ability", "event_damage", "is_critical_hit", "is_environmental",
    ],
    "defensive_assist": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated",
    ],
    "dva_remech": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated",
    ],
    "echo_duplicate_end": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "ultimate_id",
    ],
    "echo_duplicate_start": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated", "ultimate_id",
    ],
    "healing": [
        "event_type", "match_time", "healer_team", "healer_name",
        "healer_hero", "healee_team", "healee_name", "healee_hero",
        "event_ability", "event_healing", "is_health_pack",
    ],
    "hero_spawn": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "previous_hero", "hero_time_played",
    ],
    "hero_swap": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "previous_hero", "hero_time_played",
    ],
    "kill": [
        "event_type", "match_time", "attacker_team", "attacker_name",
        "attacker_hero", "victim_team", "victim_name", "victim_hero",
        "event_ability", "event_damage", "is_critical_hit", "is_environmental",
    ],
    "match_end": [
        "event_type", "match_time", "round_number",
        "team_1_score", "team_2_score",
    ],
    "match_start": [
        "event_type", "match_time", "map_name", "map_type",
        "team_1_name", "team_2_name",
    ],
    "mercy_rez": [
        "event_type", "match_time", "resurrecter_team", "resurrecter_player",
        "resurrecter_hero", "resurrectee_team", "resurrectee_player",
        "resurrectee_hero",
    ],
    "objective_captured": [
        "event_type", "match_time", "round_number", "capturing_team",
        "objective_index", "control_team_1_progress",
        "control_team_2_progress", "match_time_remaining",
    ],
    "objective_updated": [
        "event_type", "match_time", "round_number",
        "previous_objective", "current_objective_index",
    ],
    "offensive_assist": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated",
    ],
    "payload_progress": [
        "event_type", "match_time", "round_number", "capturing_team",
        "objective_index", "payload_capture_progress",
    ],
    "player_stat": [
        "event_type", "match_time", "round_number", "player_team",
        "player_name", "player_hero", "eliminations", "final_blows",
        "deaths", "all_damage_dealt", "barrier_damage_dealt",
        "hero_damage_dealt", "healing_dealt", "healing_received",
        "self_healing", "damage_taken", "damage_blocked",
        "defensive_assists", "offensive_assists", "ultimates_earned",
        "ultimates_used", "multikill_best", "multikills", "solo_kills",
        "objective_kills", "environmental_kills", "environmental_deaths",
        "critical_hits", "critical_hit_accuracy", "scoped_accuracy",
        "scoped_critical_hit_accuracy", "scoped_critical_hit_kills",
        "shots_fired", "shots_hit", "shots_missed", "scoped_shots",
        "weapon_accuracy", "hero_time_played",
    ],
    "point_progress": [
        "event_type", "match_time", "round_number", "capturing_team",
        "objective_index", "point_capture_progress",
    ],
    "remech_charged": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated", "ultimate_id",
    ],
    "round_end": [
        "event_type", "match_time", "round_number", "capturing_team",
        "team_1_score", "team_2_score", "objective_index",
        "control_team_1_progress", "control_team_2_progress",
        "match_time_remaining",
    ],
    "round_start": [
        "event_type", "match_time", "round_number", "capturing_team",
        "team_1_score", "team_2_score", "objective_index",
    ],
    "setup_complete": [
        "event_type", "match_time", "round_number", "match_time_remaining",
    ],
    "ultimate_charged": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated", "ultimate_id",
    ],
    "ultimate_end": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated", "ultimate_id",
    ],
    "ultimate_start": [
        "event_type", "match_time", "player_team", "player_name",
        "player_hero", "hero_duplicated", "ultimate_id",
    ],
}

STRING_FIELDS = frozenset({
    "event_type", "player_team", "player_name", "player_hero",
    "previous_hero", "hero_duplicated", "attacker_team", "attacker_name",
    "attacker_hero", "victim_team", "victim_name", "victim_hero",
    "event_ability", "is_critical_hit", "is_environmental",
    "map_name", "map_type", "team_1_name", "team_2_name",
    "capturing_team", "healer_team", "healer_name", "healer_hero",
    "healee_team", "healee_name", "healee_hero", "is_health_pack",
    "resurrecter_team", "resurrecter_player", "resurrecter_hero",
    "resurrectee_team", "resurrectee_player", "resurrectee_hero",
})


def parse_line(raw: str) -> dict | None:
    line = raw.strip()
    if not line:
        return None

    line = TIMESTAMP_RE.sub("", line)
    parts = [p.strip() for p in line.split(",")]

    if parts and parts[0] == "":
        parts = parts[1:]
    if not parts:
        return None

    event_type = parts[0]
    header = HEADERS.get(event_type)
    if header is None:
        return None

    event: dict = {}
    for i, key in enumerate(header):
        if i >= len(parts):
            event[key] = None
            continue
        val = parts[i]
        if key in STRING_FIELDS:
            event[key] = val
        elif val in ("", "*"):
            event[key] = 0
        else:
            try:
                event[key] = float(val)
            except ValueError:
                event[key] = val
    return event


def parse_log(content: str) -> list[dict]:
    events = []
    for line in content.splitlines():
        ev = parse_line(line)
        if ev:
            events.append(ev)
    return events
