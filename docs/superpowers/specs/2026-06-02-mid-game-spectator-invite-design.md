# Mid-Game Spectator Invite - Design

Date: 2026-06-02
Status: Approved approach, pending spec review

## Problem

A PUG admin can add a spectator at any time, but the system can only actually
invite them to the Overwatch custom game while the lobby is in a pre-game
"invitable" state. Once the match starts, spectator invites are refused: the
website marks them `PENDING_IN_GAME` and the bot has no way to reach the lobby
UI from inside a live match.

The bot account is itself a spectator (it never plays), so it can open its own
pause menu, show the lobby, send an invite, and return to the spectator view
without disrupting the running match for anyone. This design adds that
capability end to end.

## Goal

Let a spectator be invited to a custom game **while a match is live**, via two
triggers (both requested):

1. **Automatic on approval** - adding a spectator during a live match invites
   them immediately instead of parking them as `PENDING_IN_GAME`.
2. **Explicit admin action** - a per-spectator "Invite now" button for
   spectators sitting in `PENDING` or `FAILED`, as an override/retry.

## Constraints and key facts

- The bot is always a spectator in the lobby. Opening the pause menu and showing
  the lobby affects only the bot's client; players are not interrupted.
- The in-game spectator HUD and the pause menu both OCR to no known signature
  today, so `ScreenDetector.detect_screen()` returns `UNKNOWN` during a match.
  `check_health()` already treats `UNKNOWN` + state `in_game` as healthy, so the
  scheduler will not fight us.
- **Hazard:** `LobbyController.navigate_to()` has a rule "if at LOBBY and target
  is not LOBBY -> click EXIT then YES." That tears down the custom game. The
  return-to-game step must NOT go through `navigate_to`; it must be a deliberate
  ESC back to the spectator view.
- The `/instance/{id}/step` handler holds `scheduler.focus_lock` for the whole
  step, so a mid-game invite will not race the scheduler for window focus.
- Source of truth for the bot is `ow-bot-service/` in this repo (in sync with the
  deployed box). The box also has a stale `automation/automation/` duplicate that
  is NOT in the repo and must be ignored.

## Architecture

Two coordinated halves.

### A. Bot side (`ow-bot-service/`)

**`automation/screens.py`**
- Add screen signatures keyed on stable UI chrome (not roster content, since the
  test lobby is empty and real lobbies have arbitrary names):
  - `PAUSE_MENU` - recognized by the pause menu's "SHOW LOBBY" text.
  - The mid-match lobby state. It likely lacks "START" (game already running),
    so the existing `LOBBY` signature will not match it. Exact required/forbidden
    texts to be set from the live capture (see Capture phase). Detection should
    key on persistent elements such as "INVITE" / "SPECTATORS".
- These signatures are the one piece that cannot be written blind; they come from
  the capture phase.

**`automation/controller.py`**
- `show_lobby_during_game()` - press ESC to open the pause menu, confirm
  `PAUSE_MENU`, click the "SHOW LOBBY" entry, confirm arrival at the mid-match
  lobby (INVITE available).
- `return_to_game()` - ESC back to the spectator view, bypassing `navigate_to`
  entirely so EXIT+YES can never fire. The exact ESC sequence is confirmed during
  capture (user expects a single ESC).
- Make `invite_players()` self-aware about its starting screen:
  - If already at `LOBBY` (pre-game) -> behave exactly as today.
  - If a live match is detected -> `show_lobby_during_game()`, run the existing
    `_invite_one_player(tag, spectator)` for each tag, then `return_to_game()` in
    a `finally` so we always return to the match even if an invite errors.
  - The actual invite send (open INVITE panel, select Spectator, paste tag, send)
    is unchanged.
- One entry point. No new step command, no flag from the website.

### B. Website side (this repo)

**`src/pug/spectators.ts`**
- `decideSpectatorInvite(botStatus, botInstanceId)` - return `INVITE_NOW` for the
  live-match statuses currently mapped to `PENDING_IN_GAME` (at least
  `game_started`), so `addSpectator()` invites immediately mid-match. Decide
  whether `game_ended` should invite or stay pending (likely stay pending; it is
  the between-state, not a live lobby).
- No change needed to the webhook path (`invitePendingSpectators`) - it already
  invites pending specs when the pre-game lobby becomes invitable.

**`src/components/PugLobbies/index.tsx` (`SpectatorPanel`)**
- Add an "Invite now" action next to Remove for spectators in `PENDING` or
  `FAILED`. Reuses the existing status badges/notes for feedback.

**New endpoint**
- `POST /api/pug/lobby/[id]/spectators/[specId]/invite` (admin-gated like the
  existing spectator routes): looks up the spectator + `botInstanceId`, calls
  `inviteSpectator(botInstanceId, battleTag)`, updates status to `INVITED` /
  `FAILED`, returns the enriched list. This backs the manual button and is
  independent of match state.

## Data flow

Automatic:
```
admin adds spec mid-match
  -> POST /api/pug/lobby/{id}/spectators
  -> addSpectator() upserts PENDING
  -> decideSpectatorInvite() == INVITE_NOW (new: live match allowed)
  -> inviteSpectator(botInstanceId, tag)
  -> bot /instance/{id}/step invite_players
  -> invite_players detects live match -> show lobby -> invite -> return to game
  -> status INVITED or FAILED
```

Manual:
```
admin clicks "Invite now" on a PENDING/FAILED spec
  -> POST /api/pug/lobby/{id}/spectators/{specId}/invite
  -> inviteSpectator(...) -> same bot path as above
```

## Error handling

- Bot: if `show_lobby_during_game()` cannot confirm the lobby (Show Lobby not
  found, OCR fails), abort the invite, still run `return_to_game()`, and return a
  failure result. The website marks the spec `FAILED` with the note (existing
  behavior, note truncated to 300 chars).
- Bot must always attempt `return_to_game()` (finally block) so a failed invite
  never strands the client on the pause menu or lobby mid-match.
- Website: unchanged `INVITED` / `FAILED` + note surfaces in the panel and on the
  public lobby page.

## Capture phase (first implementation step)

Cannot write the `PAUSE_MENU` / mid-match-lobby signatures or confirm the return
ESC count blind. So step one is empirical:

1. Spin up a test lobby with the bot as spectator and start a match (empty teams
   are fine; signatures key on UI chrome, not players).
2. Using the bot's `/instance/{id}/screenshot` and OCR (or a small capture
   script), grab and record the OCR text + positions for:
   - the in-game spectator HUD,
   - the pause menu (ESC),
   - the Show Lobby roster,
   - the state after one ESC from the roster (to confirm the return path).
3. Use that to set the screen signatures and the return sequence, then implement.

## Testing

- Bot: with a live (empty) match, exercise `invite_players` end to end - confirm
  it opens the pause menu, shows the lobby, opens the invite panel, accepts a
  battle tag, sends, and returns to the spectator view. (An empty lobby cannot
  confirm a player actually joins, but it validates the full navigation + send.)
- Website: unit-test `decideSpectatorInvite` for the live-match statuses; verify
  the new endpoint gates on admin and updates status; manual UI check of the
  "Invite now" button against a running lobby.

## Deployment

The website ships via CI/CD on push to main. The bot does NOT - it runs on the
Windows box (185.154.146.242) and is deployed manually over SSH as user
`administrator`:

1. Copy the changed files into `C:\ow-bot-service\...` (e.g. `scp` over SSH, or
   the bot's `/deploy-file` endpoint).
2. Restart via the scheduled task: `schtasks /end /tn OWBotAPI`, force-kill any
   lingering `python.exe` (the `/end` does not reap the detached child), then
   `schtasks /run /tn OWBotAPI`. Do NOT launch `start_api.py` directly over SSH -
   it dies when the SSH session closes. The `OWBotWatchdog` task also backstops a
   crash within ~2 min.
3. Verify: `netstat -ano | findstr :8420` listening and `GET /health` returns ok.

Edit the repo copy under `ow-bot-service/` (source of truth), then deploy that to
the box. Ignore the stale `automation/automation/` copy on the box.

## Open items for the plan

- Confirm exactly which `botStatus` values count as "invite live now" vs stay
  pending (`game_started` yes; `game_ended` likely no).
- Confirm the return-to-game ESC count from the capture.

## Out of scope

- Auto-removing/uninviting spectators mid-match.
- Any change to how players (non-spectators) are invited.
- Reconciling or removing the stale `automation/automation/` duplicate on the box
  (worth doing separately, not part of this feature).
