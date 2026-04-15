# Elemental ScrimTime Fork - Position Tracking Add-On

## Overview

This is a set of **additional Workshop rules** to add to the existing ScrimTime code (DKEEH v1.71).
These rules add position tracking data to the log output for use with the Elemental replay viewer.

**You do NOT replace ScrimTime** - you ADD these rules to it.

## How to Set Up

### Step 1: Import ScrimTime
1. In Overwatch 2, go to **Play → Custom Games → Create**
2. Click **Settings → Import Code** and enter: `DKEEH`
3. This loads the base ScrimTime code

### Step 2: Add Position Tracking Rules
1. Go to **Settings → Workshop**
2. Click **Open Workshop Editor**
3. At the bottom of the existing rules, click **Add Rule** to create each new rule below
4. Copy each rule exactly as described

### Step 3: Configure Settings
1. In **Settings → Workshop Settings**, you'll see a new section:
   - **Position Tracking** section:
     - **Enable Position Tracking**: On (default: On)
     - **Snapshot Interval**: 0.50 / 1.00 seconds (default: 0.50)
     - **Movement Threshold**: 0.50m (default: 0.50 - only logs when player moves >0.5m)

### Step 4: Enable Log File Output
1. Go to game **Settings → Gameplay → General**
2. Enable **Workshop Inspector Log File** ✅
3. This only needs to be done ONCE on the host's computer

### Step 5: Save as Preset & Get Share Code
1. After adding all rules, click **Back** to exit the Workshop Editor
2. Under the **Presets** section, click **Save Preset** and name it "Elemental ScrimTime"
3. To share: click **Share** next to the preset name to get a code
4. Anyone can then import your code with all rules included

---

## Workshop Rules to Add

> **IMPORTANT**: These rules use player variables. ScrimTime uses variables A-F.
> Our rules use variables **P** (LastLoggedPos) and **Q** (IsTracking) to avoid conflicts.

---

### Rule 1: "ELMT - Position Snapshot (Periodic)"

This is the main position logging rule. It fires for each alive player, checks the movement
threshold, and logs their position + extended data at the configured interval.

```
Rule "ELMT - Position Snapshot (Periodic)"
{
    event
    {
        Ongoing - Each Player;
        All;
        All;
    }

    conditions
    {
        // Only run when game is in progress and position tracking is enabled
        Is Game In Progress == True;
        Is Alive(Event Player) == True;

        // Movement threshold: only log if moved >threshold since last logged position
        // This eliminates ~30-40% of writes during standstills / setup / between rounds
        Distance Between(
            Position Of(Event Player),
            Event Player.P
        ) > Workshop Setting Real(Custom String("Position Tracking"), Custom String("Movement Threshold (meters)"), 0.50, 0.10, 3.00);

        // Master toggle
        Workshop Setting Toggle(Custom String("Position Tracking"), Custom String("Enable Position Tracking"), True) == True;
    }

    actions
    {
        // Store current position as last logged position
        Event Player.P = Position Of(Event Player);

        // Log the position snapshot
        // Format: timestamp,player_position,match_time,team,name,hero,x,y,z,ult_charge,is_alive,facing_x,facing_z,health,in_spawn,on_ground
        Log To Inspector(Custom String(
            "{0},player_position,{1},{2}",
            Total Time Elapsed,
            Match Time,
            Custom String(
                "{0},{1},{2}",
                Team Of(Event Player),
                Custom String("{0}", Event Player),
                Custom String(
                    "{0},{1},{2},{3}",
                    Hero Of(Event Player),
                    X Component Of(Position Of(Event Player)),
                    Y Component Of(Position Of(Event Player)),
                    Z Component Of(Position Of(Event Player))
                )
            )
        ));

        // Log extended fields in a second line (Workshop has a ~128 char limit per Custom String)
        // This continues the CSV row with: ult_charge,is_alive,facing_x,facing_z,health,in_spawn,on_ground
        Log To Inspector(Custom String(
            ",{0},{1},{2},{3},{4},{5},{6}",
            Ultimate Charge Percent(Event Player),
            1,
            X Component Of(Facing Direction Of(Event Player)),
            Z Component Of(Facing Direction Of(Event Player)),
            Normalized Health(Event Player),
            Is In Spawn Room(Event Player),
            Is On Ground(Event Player)
        ));

        // Wait for the configured interval, then loop
        Wait(
            Workshop Setting Real(Custom String("Position Tracking"), Custom String("Snapshot Interval (seconds)"), 0.50, 0.25, 2.00),
            Ignore Condition
        );
        Loop If Condition Is True;
    }
}
```

**⚠️ IMPORTANT NOTE about the two Log To Inspector calls:**

The Overwatch Workshop has a character limit on `Custom String` (~128 chars). Position snapshots have 15 fields which exceed this. There are two approaches:

**Option A (Recommended - Single Line):** If you can fit it, use nested Custom Strings:
```
Log To Inspector(Custom String(
    "{0},player_position,{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13},{14}",
    Total Time Elapsed,
    Match Time,
    Team Of(Event Player),
    Custom String("{0}", Event Player),
    Hero Of(Event Player),
    X Component Of(Position Of(Event Player)),
    Y Component Of(Position Of(Event Player)),
    Z Component Of(Position Of(Event Player)),
    Ultimate Charge Percent(Event Player),
    1,
    X Component Of(Facing Direction Of(Event Player)),
    Z Component Of(Facing Direction Of(Event Player)),
    Normalized Health(Event Player),
    Is In Spawn Room(Event Player),
    Is On Ground(Event Player)
));
```

**Note:** Workshop `Custom String` only supports `{0}`, `{1}`, `{2}` (3 params max). So you need to nest them. Here's the correct nesting:

```
Log To Inspector(Custom String("{0},{1},{2}",
    Custom String("{0},player_position,{1},{2}",
        Total Time Elapsed,
        Match Time,
        Team Of(Event Player)
    ),
    Custom String("{0},{1},{2}",
        Custom String("{0}", Event Player),
        Hero Of(Event Player),
        Custom String("{0},{1},{2}",
            X Component Of(Position Of(Event Player)),
            Y Component Of(Position Of(Event Player)),
            Z Component Of(Position Of(Event Player))
        )
    ),
    Custom String("{0},{1},{2}",
        Custom String("{0},{1},{2}",
            Ultimate Charge Percent(Event Player),
            True,
            X Component Of(Facing Direction Of(Event Player))
        ),
        Custom String("{0},{1},{2}",
            Z Component Of(Facing Direction Of(Event Player)),
            Normalized Health(Event Player),
            Is In Spawn Room(Event Player)
        ),
        Is On Ground(Event Player)
    )
));
```

---

### Rule 2: "ELMT - Death Position Marker"

Logs a final position snapshot when a player dies (is_alive = 0).

```
Rule "ELMT - Death Position Marker"
{
    event
    {
        Player Died;
        All;
        All;
    }

    conditions
    {
        Is Game In Progress == True;
        Workshop Setting Toggle(Custom String("Position Tracking"), Custom String("Enable Position Tracking"), True) == True;
    }

    actions
    {
        Log To Inspector(Custom String("{0},{1},{2}",
            Custom String("{0},player_position,{1},{2}",
                Total Time Elapsed,
                Match Time,
                Team Of(Event Player)
            ),
            Custom String("{0},{1},{2}",
                Custom String("{0}", Event Player),
                Hero Of(Event Player),
                Custom String("{0},{1},{2}",
                    X Component Of(Position Of(Event Player)),
                    Y Component Of(Position Of(Event Player)),
                    Z Component Of(Position Of(Event Player))
                )
            ),
            Custom String("{0},{1},{2}",
                Custom String("{0},{1},{2}",
                    Ultimate Charge Percent(Event Player),
                    False,
                    X Component Of(Facing Direction Of(Event Player))
                ),
                Custom String("{0},{1},{2}",
                    Z Component Of(Facing Direction Of(Event Player)),
                    Normalized Health(Event Player),
                    Is In Spawn Room(Event Player)
                ),
                Is On Ground(Event Player)
            )
        ));
    }
}
```

---

### Rule 3: "ELMT - Enhanced Kill Positions"

This modifies the kill event to also log attacker/victim positions.
**Note:** This creates a SEPARATE log line with positions that our parser matches to kills by timestamp.

```
Rule "ELMT - Enhanced Kill Positions"
{
    event
    {
        Player Dealt Final Blow;
        All;
        All;
    }

    conditions
    {
        Is Game In Progress == True;
        Workshop Setting Toggle(Custom String("Position Tracking"), Custom String("Enable Position Tracking"), True) == True;
    }

    actions
    {
        // Log kill positions (matched to the kill event by match_time timestamp)
        // Format: timestamp,kill_position,match_time,attacker_x,attacker_y,attacker_z,victim_x,victim_y,victim_z
        Log To Inspector(Custom String("{0},{1},{2}",
            Custom String("{0},kill_position,{1},{2}",
                Total Time Elapsed,
                Match Time,
                X Component Of(Position Of(Event Player))
            ),
            Custom String("{0},{1},{2}",
                Y Component Of(Position Of(Event Player)),
                Z Component Of(Position Of(Event Player)),
                X Component Of(Position Of(Victim))
            ),
            Custom String("{0},{1}",
                Y Component Of(Position Of(Victim)),
                Z Component Of(Position Of(Victim))
            )
        ));
    }
}
```

---

## Workshop Settings Summary

When these rules are added, the Workshop Settings menu will show:

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Enable Position Tracking** | On | On/Off | Master toggle |
| **Snapshot Interval (seconds)** | 0.50 | 0.25 - 2.00 | How often to log positions. Use 0.50 for smooth replays, 1.00 if FPS is impacted |
| **Movement Threshold (meters)** | 0.50 | 0.10 - 3.00 | Minimum movement to trigger a log. Eliminates duplicate logs during standstills |

---

## FPS Impact Notes

- **Position Tracking at 0.5s**: ~20 Log To Inspector calls/second (10 players × 2/sec). Moderate impact.
- **Position Tracking at 1.0s**: ~10 Log To Inspector calls/second. Low impact.
- **Kill Positions**: Negligible - kills are rare events (~3-5/minute).
- **Movement Threshold**: Reduces actual writes by ~30-40% during setup, halftime, and standstills.

> **Recommendation**: Start with 0.50s for best replay quality. If the host reports FPS drops,
> switch to 1.00s in the Workshop Settings - no need to reimport the code.

---

## ScrimTime Settings to Adjust

For the best experience with Elemental's replay viewer, we recommend these ScrimTime settings:

1. **Log Generator → Enable Log Generator**: **On** (required)
2. **Log Generator → Kill**: **On** (required)
3. **Log Generator → Ultimate**: **On** (recommended)
4. **Log Generator → Match Start**: **On** (required for round detection)
5. **Log Generator → Damage**: Off (unless needed - high volume)
6. **Log Generator → Healing**: Off (unless needed - high volume)
7. **Log Generator → Abilities Used**: Off (high volume, FPS impact)

---

## How to Publish Tonight

1. Create a Custom Game in Overwatch 2
2. Import ScrimTime: `DKEEH`
3. Open Workshop Editor, add all 3 rules above
4. Adjust settings as described
5. Save as preset: "Elemental ScrimTime"
6. Click **Share** to get a share code
7. Give the share code to your team captains

The share code will let anyone import the full setup (ScrimTime + your position tracking rules)
with one code. No need to add rules manually each time.

---

## Parsing

Our parser already handles the `player_position` event type. When you upload logs from this
code, the Replay tab will automatically show position data with the map background.

The `kill_position` events are matched by timestamp to enhance kill events with location data.
