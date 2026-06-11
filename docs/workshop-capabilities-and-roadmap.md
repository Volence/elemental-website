# OW Workshop: Capabilities + PUG Roadmap

A map of what the Overwatch Workshop can do, what your ScrimTime fork **already**
does, and a prioritized list of what's worth building - grounded in the actual
mod (`docs/elemental-scrimtime.txt`, 2960 lines, 81 rules) and the OverPy
reference (the best browsable catalog of the Workshop API).

---

## 0. TL;DR

The biggest finding: **your stat-tracker mod is far more capable than what you
currently use.** It already logs nearly every meaningful event, ships three
in-game spectator scoreboards, and has a full ready-up / setup / captain system -
most of it toggled off or unused. So "what can we improve" splits three ways:

1. **Use what's already there** (zero workshop code - just flip settings / wire the bot to existing logs).
2. **Small workshop additions** (a handful of new rules in the mod).
3. **Website/bot-side** (the workshop already emits the data; we just consume it better).

Most high-value wins are in buckets 1 and 3, not risky workshop rewrites.

---

## 1. What your ScrimTime fork ALREADY does

### Event logging (via `Log To Inspector` -> your bot reads the log)
Already emits, each with a match timestamp:
`match_start/end`, `round_start/end`, `setup_complete`, `point_progress`,
`payload_progress`, `objective_captured/updated`, `kill`, `hero_spawn`,
`hero_swap`, `damage`, `healing`, `offensive_assist`, `defensive_assist`,
`ability_1_used`, `ability_2_used`, `ultimate_charged/start/end`,
`dva_remech`, `echo_duplicate_start/end`, `mercy_rez`, and a periodic
`player_stat` summary.

That is essentially the full competitive event stream. **The data you'd want for
almost any analytics feature is already being produced** - the question is just
cadence and what the website does with it.

### In-game spectator scoreboards (already built!)
Three selectable styles - **A (Standard)**, **B (Legacy Standard)**,
**C (Legacy OWL/OWC)** - each in Small/Medium/Large, with a legend and a live
match-time display. Toggled via the in-lobby "5. Spectator Scoreboard" setting.
This is the in-game caster overlay I was about to suggest building - it exists.

### Setup / ready-up / captain flow
Full ready-up system (all-players or captain-only mode), configurable countdown,
setup-time control (add/freeze/cap), defender teleport-to-objective, per-player
language. Configurable via settings "2. Ready Up" and "3. Setup Phase".

### Per-mode match completion
Correct round/match-end handling for Assault, Escort, Hybrid, Control,
Flashpoint, and Clash.

### Configurable in-lobby settings (no code needed to change)
8 categories exposed in the custom-game settings UI: `1. Language`,
`2. Ready Up System`, `3. Setup Phase`, `4. Map Completion`,
`5. Spectator Scoreboard`, `6. Log Generator` (per-stat toggles:
kills/deaths, hero swaps, ultimates, damage, healing, assists, etc.),
`7. Keybinds`, `8. Debug`. Note: `Damage*` and `Healing*` logging default
to **False** - turning those on is a one-setting change.

### Debug tooling
Force-ready, reduce timer, spawn test bot, auto-end match, server-load display.

---

## 2. What the Workshop CAN do (the capability menu)

The Workshop is an event-driven engine. Every feature is "on event X, run
actions." This is the palette to browse in the OverPy reference.

### Rule events (triggers)
- **Ongoing - Each Player** / **Ongoing - Global** (continuous condition checks)
- **Subroutines** (reusable action blocks, called from rules)
- Player events: earned elimination, dealt final blow, died, dealt/took damage,
  dealt/received healing, used ability 1/2, used ultimate, ult charge changed,
  hero spawned/changed, joined/left match, was resurrected.

### Data you can read (values)
Per player: hero, health/armor/shields, position/facing, is alive, is firing,
ability cooldowns, ult charge %, score, eliminations/deaths/damage/healing (the
in-game accumulators), team, slot. Global: match time, round, team scores, game
mode, current map, players on each team, server load.

### Output / communication (this is the only way data leaves the game)
- **`Log To Inspector`** - writes a line to the workshop log -> your bot tails it.
  This is your data bridge. There is no HTTP/network from inside the Workshop.
- **HUD text** (`hudText` / header / subheader / subtext) - persistent on-screen
  text per player/team/all, positioned, colored, sized. The scoreboards are this.
- **In-world text**, progress bars, icons, effects, beams - spatial overlays.
- **Big/small messages**, objective description, ping-on-map.

### Match control
Set team score, declare victory/draw, pause/unpause match time, set game-mode
params, control round flow, set/skip setup time, end the match.

### Player manipulation
Teleport, start/stop forcing hero, set max health, set move speed, set gravity,
set ability cooldown/charge, set ult charge, set invisible/phased, apply status
(frozen/stunned/etc.), set respawn time, knockback/heal/damage.

---

## 3. Hard limits (so we don't chase impossible features)

- **No network.** The game can't call your API. Data only escapes via
  `Log To Inspector` (bot tails the log). Inbound control is the bot pressing
  keys bound to workshop rules (how pause / end-game already work).
- **No true function returns or arbitrary recursion** - logic is rule/subroutine
  based; complex algorithms get awkward.
- **Element / instruction budget** - mods have a cap on total elements (ScrimTime
  is already large). Big additions need to mind the budget (`#!debugElementCount`
  in OverPy reports usage).
- **Hero bans / roster limits are a lobby SETTING, not code** - enable/disable
  heroes per team in the custom-game settings (we'd add this in
  `settingsGenerator.ts`), not via workshop rules. Cleaner and reliable.
- **Text is limited** - custom strings have length/among-other limits; big
  dynamic text needs care.

---

## 4. Prioritized roadmap for the PUG system

Each item notes **where it lives**: `[settings]` (no code), `[workshop]` (mod
rule), `[website]`/`[bot]` (consume existing logs).

### Tier 1 - high value, low effort
1. **Turn on the data you're already paying for.** `[settings]` Enable `Damage*`
   and `Healing*` in the Log Generator (default off). Confirm Abilities/Assists
   are on if you want them. Zero code; richer post-match analytics immediately.
2. **Live scoreboard cadence fix (the deferred #1).** `[workshop]` ScrimTime only
   dumps the `player_stat` summary at round end / between Flashpoint captures. Add
   one timed-loop rule that calls the existing summary subroutine every ~10-15s so
   the website live scoreboard updates mid-round. Small, isolated addition - the
   subroutine already exists.
3. **Use the built-in spectator scoreboard for casting.** `[settings]` It's
   already in the mod - pick a style/size in setting "5." for the bot's spectator
   view. Instant in-game overlay with no build.
4. **First-pick / first-death / fight-win tracking.** `[website]` Derive entirely
   from the `kill` log you already emit (cluster kills into fights by timestamp).
   No workshop change - pure analytics on existing data.

### Tier 2 - high value, medium effort
5. **Ult economy view.** `[workshop]+[website]` You log ult charged/start/end.
   Add a periodic dump of each player's live ult-charge % (one small rule) ->
   website caster overlay shows "ults up" per team in real time.
6. **Auto-pause on mid-match disconnect.** `[workshop]` On `Player Left Match`
   during live play: pause + big message ("Player DC'd - paused"). Pairs with the
   native pause you just wired. Big QoL during events.
7. **End-of-game MVP / summary screen.** `[workshop]` At match end, compute top
   damage/elims/healing from in-game accumulators and show a HUD summary for ~15s -
   complements the website's post-match analytics page.

### Tier 3 - nice to have / bigger
8. **In-game hero-ban enforcement.** `[settings]` for hard bans (disable heroes in
   lobby settings); `[workshop]` only if you want "banned hero picked -> warn +
   force swap" soft enforcement.
9. **Automated warmup/aim-drill mode** between lobbies. `[workshop]` teleport +
   set-hero + targets - separate mode, real authoring effort. Good OverPy project.
10. **Captain-driven in-game pick/ban.** `[workshop]` You already do bans on the
    website, so low priority - listed for completeness.

---

## 5. How to actually explore/learn (OverPy as the tool)

You don't have to adopt OverPy as a build tool to use it as the manual:
- **Reference** - browse the function/value/event catalog to discover what's
  possible (far better than the in-game dropdowns).
- **Web demo** (`zezombye.github.io/overpy/demo`) - write a few lines, see the
  compiled Workshop output, paste into a local custom game, watch it run. Fastest
  "is this possible?" -> "yes" loop.
- **Decompile** ScrimTime (or any mod) to OverPy to read *how* it's built and copy
  techniques.
- If/when we build Tier 2-3 items, authoring the *new* rules in OverPy and
  appending the compiled output (the same way `workshopTemplate.ts` appends
  `ADMIN_RULES`) gives clean source without decompiling the whole mod.

---

### Suggested first step
Tier 1 items 1 + 3 are pure settings (do today, zero risk), and item 2 (live
scoreboard cadence) is the smallest workshop change with the most visible payoff.
That's a low-risk way to validate the whole approach before committing to anything
bigger.
