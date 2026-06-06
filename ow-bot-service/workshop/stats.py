import logging
from dataclasses import dataclass, field

log = logging.getLogger("ow-bot.workshop.stats")


@dataclass
class PlayerStats:
    team: str = ""
    hero: str = ""
    eliminations: int = 0
    final_blows: int = 0
    deaths: int = 0
    damage_dealt: float = 0
    hero_damage: float = 0
    barrier_damage: float = 0
    healing_dealt: float = 0
    ultimates_earned: int = 0
    ultimates_used: int = 0

    def to_dict(self) -> dict:
        return {
            "team": self.team,
            "hero": self.hero,
            "eliminations": self.eliminations,
            "finalBlows": self.final_blows,
            "deaths": self.deaths,
            "damageDelt": round(self.damage_dealt),
            "heroDamage": round(self.hero_damage),
            "barrierDamage": round(self.barrier_damage),
            "healingDealt": round(self.healing_dealt),
            "ultimatesEarned": self.ultimates_earned,
            "ultimatesUsed": self.ultimates_used,
        }


class MatchStats:
    """Accumulates live stats from parsed workshop events."""

    def __init__(self):
        self.map_name: str | None = None
        self.map_type: str | None = None
        self.team_1_name: str = "Team 1"
        self.team_2_name: str = "Team 2"
        self.team_1_score: int = 0
        self.team_2_score: int = 0
        self.round_number: int = 0
        self.match_time: float = 0
        self.match_result: str | None = None
        self.match_ended: bool = False
        self.players: dict[str, PlayerStats] = {}
        # Authoritative per-(player, hero) stat dumps. OW dumps one player_stat
        # row per hero a player used, so we keep them separately and sum across
        # a player's heroes - otherwise a freshly-swapped hero's 0-row would
        # overwrite (zero) the player's totals.
        self._hero_dumps: dict[tuple[str, str], dict] = {}
        self._event_count: int = 0

    def process_event(self, event: dict) -> None:
        etype = event.get("event_type")
        if not etype:
            return
        self._event_count += 1
        mt = event.get("match_time")
        if isinstance(mt, (int, float)) and mt > self.match_time:
            self.match_time = mt

        handler = getattr(self, f"_handle_{etype}", None)
        if handler:
            handler(event)

    def _player(self, name: str, team: str = "", hero: str = "") -> PlayerStats:
        if name not in self.players:
            self.players[name] = PlayerStats(team=team, hero=hero)
        ps = self.players[name]
        if team:
            ps.team = team
        if hero:
            ps.hero = hero
        return ps

    # ── Event handlers ──

    def _handle_match_start(self, e: dict):
        self.map_name = e.get("map_name")
        self.map_type = e.get("map_type")
        self.team_1_name = e.get("team_1_name") or "Team 1"
        self.team_2_name = e.get("team_2_name") or "Team 2"

    def _handle_match_end(self, e: dict):
        self.match_ended = True
        t1 = int(e.get("team_1_score", 0))
        t2 = int(e.get("team_2_score", 0))
        self.team_1_score = t1
        self.team_2_score = t2
        if t1 > t2:
            self.match_result = "team1"
        elif t2 > t1:
            self.match_result = "team2"
        else:
            self.match_result = "draw"

    def _handle_round_start(self, e: dict):
        self.round_number = int(e.get("round_number", 0))

    def _handle_round_end(self, e: dict):
        self.team_1_score = int(e.get("team_1_score", 0))
        self.team_2_score = int(e.get("team_2_score", 0))

    def _handle_kill(self, e: dict):
        attacker = e.get("attacker_name")
        victim = e.get("victim_name")
        if attacker:
            ps = self._player(attacker, e.get("attacker_team", ""), e.get("attacker_hero", ""))
            ps.final_blows += 1
        if victim:
            ps = self._player(victim, e.get("victim_team", ""), e.get("victim_hero", ""))
            ps.deaths += 1

    def _handle_damage(self, e: dict):
        attacker = e.get("attacker_name")
        if attacker:
            ps = self._player(attacker, e.get("attacker_team", ""), e.get("attacker_hero", ""))
            dmg = float(e.get("event_damage", 0))
            ps.damage_dealt += dmg
            ps.hero_damage += dmg

    def _handle_healing(self, e: dict):
        healer = e.get("healer_name")
        if healer:
            ps = self._player(healer, e.get("healer_team", ""), e.get("healer_hero", ""))
            ps.healing_dealt += float(e.get("event_healing", 0))

    def _handle_hero_spawn(self, e: dict):
        name = e.get("player_name")
        if name:
            self._player(name, e.get("player_team", ""), e.get("player_hero", ""))

    def _handle_hero_swap(self, e: dict):
        name = e.get("player_name")
        if name:
            ps = self._player(name, e.get("player_team", ""))
            ps.hero = e.get("player_hero") or ps.hero

    def _handle_ultimate_charged(self, e: dict):
        name = e.get("player_name")
        if name:
            self._player(name, e.get("player_team", ""), e.get("player_hero", "")).ultimates_earned += 1

    def _handle_ultimate_start(self, e: dict):
        name = e.get("player_name")
        if name:
            self._player(name, e.get("player_team", ""), e.get("player_hero", "")).ultimates_used += 1

    _DUMP_FIELDS = (
        "eliminations", "final_blows", "deaths", "damage_dealt", "hero_damage",
        "barrier_damage", "healing_dealt", "ultimates_earned", "ultimates_used",
    )

    def _handle_player_stat(self, e: dict):
        """Authoritative per-hero stat dump. OW emits one row per hero a player
        used, so store per (player, hero) and SUM across the player's heroes -
        otherwise a just-swapped hero's 0-row would zero the player's totals.
        Leaves ps.hero alone so the current hero (from hero_spawn/hero_swap)
        keeps showing."""
        name = e.get("player_name")
        if not name:
            return
        hero = e.get("player_hero", "")
        self._hero_dumps[(name, hero)] = {
            "eliminations": int(e.get("eliminations", 0)),
            "final_blows": int(e.get("final_blows", 0)),
            "deaths": int(e.get("deaths", 0)),
            "damage_dealt": float(e.get("all_damage_dealt", 0)),
            "hero_damage": float(e.get("hero_damage_dealt", 0)),
            "barrier_damage": float(e.get("barrier_damage_dealt", 0)),
            "healing_dealt": float(e.get("healing_dealt", 0)),
            "ultimates_earned": int(e.get("ultimates_earned", 0)),
            "ultimates_used": int(e.get("ultimates_used", 0)),
        }
        ps = self._player(name, e.get("player_team", ""))
        agg = {f: 0 for f in self._DUMP_FIELDS}
        for (n, _h), d in self._hero_dumps.items():
            if n == name:
                for f in self._DUMP_FIELDS:
                    agg[f] += d[f]
        for f in self._DUMP_FIELDS:
            setattr(ps, f, agg[f])

    def _handle_objective_captured(self, e: dict):
        """Flashpoint scores by points captured and never fires round_end per
        point, so the live score must count captures. Other modes capture
        checkpoints that are NOT score, so only count for Flashpoint."""
        if "flashpoint" not in (self.map_type or "").strip().lower():
            return
        team = e.get("capturing_team", "")
        if team == self.team_1_name:
            self.team_1_score += 1
        elif team == self.team_2_name:
            self.team_2_score += 1

    def snapshot(self) -> dict:
        team1 = {}
        team2 = {}
        for name, ps in self.players.items():
            d = ps.to_dict()
            if ps.team == self.team_1_name:
                team1[name] = d
            else:
                team2[name] = d

        return {
            "map": self.map_name,
            "mapType": self.map_type,
            "team1": {
                "name": self.team_1_name,
                "score": self.team_1_score,
                "players": team1,
            },
            "team2": {
                "name": self.team_2_name,
                "score": self.team_2_score,
                "players": team2,
            },
            "round": self.round_number,
            "matchTime": round(self.match_time, 1),
            "matchEnded": self.match_ended,
            "matchResult": self.match_result,
            "eventCount": self._event_count,
        }
