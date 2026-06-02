# Mid-Game Spectator Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a spectator be invited to an Overwatch custom game while a match is live, via both automatic-on-approval and an explicit per-spectator "Invite now" button.

**Architecture:** The bot account is a spectator, so it can ESC into its own pause menu, click "Show Lobby", invite, and ESC back without disrupting play. We make the bot's `invite_players` self-aware: when the instance is `in_game` it opens the lobby via the pause menu instead of the menu tree, then returns to the spectator view. On the website we flip the `game_started` decision from "can't invite" to "invite now", and add a manual override endpoint + button.

**Tech Stack:** Python 3.12 (FastAPI, pyautogui, easyocr) for the bot in `ow-bot-service/`; Next.js + TypeScript + Prisma + Payload for the website; vitest for website tests.

---

## Important context

- The bot source of truth is `ow-bot-service/` in this repo, in sync with the Windows box `C:\ow-bot-service`. **Ignore** the box-only stale `automation/automation/` duplicate.
- The bot has **no unit-test harness** (it is GUI automation). Bot-side verification is **live**: deploy to the box, exercise via the HTTP API, observe screenshots/logs. Only the website gets vitest TDD.
- Bot deploy (you, over SSH as `administrator@185.154.146.242`): copy changed files into `C:\ow-bot-service\...`, then restart via the `OWBotAPI` scheduled task (`schtasks /end /tn OWBotAPI`, force-kill lingering `python.exe`, `schtasks /run /tn OWBotAPI`). Never run `start_api.py` directly over SSH (dies on disconnect). Verify `netstat -ano | findstr :8420` listening and `GET /health` ok. The `OWBotWatchdog` task also backstops a crash within ~2 min.
- Work on branch `feat/mid-game-spectator-invite`. Commit per task. Do NOT push to `main` until the whole feature is verified (push to main triggers website CI/CD).
- Helper to run an SSH command on the box used throughout:
  `ssh -o BatchMode=yes administrator@185.154.146.242 "<cmd>"`

---

## Phase 0 - Live capture (gates the bot signatures)

### Task 1: Capture pause-menu and mid-match-lobby OCR

This produces the exact OCR text the bot sees, which determines the `PAUSE_MENU` signature (Task 2) and the "Show Lobby" / return clicks (Task 3). It cannot be guessed.

**Files:** none changed. Output is recorded into this plan's Task 2/Task 3 notes.

- [ ] **Step 1: Confirm an instance is in a live match.** Start a test lobby with the bot as spectator and start a match (empty teams are fine). Get the instance id and confirm it is in game:

Run: `ssh -o BatchMode=yes administrator@185.154.146.242 "powershell -Command \"$s=((Get-Content C:\ow-bot-service\.env|?{$_ -match 'SECRET'}) -split '=',2)[1].Trim(); (Invoke-WebRequest -Uri http://127.0.0.1:8420/instances -Headers @{'X-Bot-Secret'=$s} -UseBasicParsing).Content\""`
Expected: JSON listing instances; note the `id` whose `state` is `in_game` (call it `INST`).

- [ ] **Step 2: Capture the in-game HUD OCR** (baseline - confirms a live match reads UNKNOWN). Use the existing `navigate` step in dry form via the screenshot endpoint, then OCR. Simplest is the `debug-invite` style is not safe here; instead grab a screenshot and the OCR via a one-off: drive the detector with the `/instance/{INST}/sync` endpoint which returns the detected screen:

Run: `ssh ... "powershell ... Invoke-WebRequest -Method POST -Uri http://127.0.0.1:8420/instance/$INST/sync ..."`
Expected: `screen: "unknown"` while the match HUD is up. Record it.

- [ ] **Step 3: Capture the PAUSE MENU OCR.** Manually (or via a temporary capture) press ESC on the bot's client and grab the screenshot + OCR text list. Use the bot screenshot endpoint plus a local OCR, OR add a temporary one-shot script `ow-bot-service/scripts/capture_pause.py` that focuses the window, presses escape, scans, and prints `find_all_text()`. Run it on the box. Record the exact text tokens and their confidences for the pause menu, **especially how "SHOW LOBBY" is tokenized** (one token "SHOW LOBBY" vs two tokens "SHOW" + "LOBBY").

- [ ] **Step 4: Capture the SHOW LOBBY roster OCR.** From the pause menu, click Show Lobby; capture the roster screenshot + OCR. Confirm "INVITE" is present and that "START" is **absent**. Record the tokens.

- [ ] **Step 5: Capture the return path.** From the roster, press ESC once; capture. Note whether one ESC lands back on the spectator HUD or on the pause menu (this sets the ESC count in `return_to_game`). Record it.

- [ ] **Step 6: Write the findings into this plan.** Fill the "CAPTURE RESULT" notes in Task 2 and Task 3 with the actual tokens/counts before implementing them. Remove any temporary capture script from the box and repo.

**CAPTURE RESULT (captured live 2026-06-02 on inst-0):**
- Pause menu OCR: `['Overwatch','BACK','MENU','SOCIAL','CHALLENGES','CAREER PROFILE','OPTIONS','OPEN WORKSHOP EDITOR','OPEN WORKSHOP INSPECTOR','SHOW LOBBY','PAUSE MATCH','LEAVE GAME','EXIT TO DESKTOP','CHAT','BACK']`. `SHOW LOBBY` is a **single clean token** -> signature `required=["SHOW LOBBY"]` and `click_text("SHOW LOBBY")` both work as written.
- Show Lobby roster OCR: `['Overwatch','BACK','MOVE','SETTINGS','INVITE','ADD','PARAISO','Team','Team 2','EMPTY'...,'SPECTATORS','BACK TO LOBBY','RESTART MATCH','CHAT','SELECT','BACK']`. `INVITE` present (single token) -> confirm arrival via `find_text("INVITE")`. **`START` is absent** -> pre-game LOBBY signature does NOT false-match the mid-match roster (roster reads UNKNOWN; we key off INVITE).
- In-game HUD baseline OCR: `['Overwatch','GET READY','READY FOR BATTLE','PRESS B FOR SPECTATOR OPTIONS']` -> reads UNKNOWN as expected.
- ESC presses to return roster -> spectator HUD: **2 escapes** (roster -> pause menu -> live game), confirmed by operator. `return_to_game()`'s ESC-until-no-lobby-UI loop lands correctly with 2 ESC (ESC1 -> PAUSE_MENU, ESC2 -> in-game UNKNOWN with no INVITE -> stop).

**EDGE CASE found during capture (health watchdog vs UNKNOWN screens):**
The scheduler health check (`automation/scheduler.py` `_execute_health_check`) counts every `UNKNOWN` frame as a failure with NO exemption for `in_game`, and at 10 consecutive failures (~5 min at 30s interval) marks the instance ERROR and kills/relaunches OW. The pause menu and Show Lobby roster both read UNKNOWN, so leaving the bot there ~5 min tears down the match. For OUR feature this is mitigated because the `/step` invite holds `scheduler.focus_lock`, and the health check also acquires that lock via `_execute_focus_task` - so the watchdog CANNOT run during the invite. Task 4 additionally resets the instance's health failure counter on a successful mid-game lobby reach (proof OW is responsive). NOTE (out of scope, flag to user): the same watchdog could in principle affect any long in-game UNKNOWN period; not addressed by this feature.

---

## Phase 1 - Bot (`ow-bot-service/`)

### Task 2: Add PAUSE_MENU screen signature

**Files:**
- Modify: `ow-bot-service/automation/screens.py` (the `Screen` enum and `_SCREEN_SIGNATURES`)

- [ ] **Step 1: Add the enum value.** `Screen.PAUSE_MENU` already does not exist; add it next to the other in-game states. In `screens.py`, in `class Screen(Enum)`, after `IN_GAME = "in_game"` add:

```python
    PAUSE_MENU = "pause_menu"
```

- [ ] **Step 2: Add the signature.** In `_SCREEN_SIGNATURES`, add PAUSE_MENU as the FIRST entry (most specific). Use the token(s) recorded in Task 1. If "SHOW LOBBY" is a single OCR token use `["SHOW LOBBY"]`; if split, use `["SHOW", "LOBBY"]`. Forbid the lobby/menu signatures so it never collides:

```python
_SCREEN_SIGNATURES: list[tuple[Screen, list[str], list[str]]] = [
    (Screen.PAUSE_MENU,   ["SHOW LOBBY"], ["START", "IMPORT", "CREATE"]),
    (Screen.SETTINGS,     ["IMPORT"],   []),
    (Screen.LOBBY,        ["START"],    ["IMPORT"]),
    (Screen.CUSTOM_GAMES, ["CREATE"],   ["START"]),
    (Screen.PLAY_MENU,    ["CUSTOM"],   ["CREATE"]),
    (Screen.MAIN_MENU,    ["PLAY"],     ["CUSTOM", "CREATE", "START"]),
]
```

- [ ] **Step 3: Deploy + verify detection.** Copy `screens.py` to the box and restart the task (see deploy steps in Important context). With the bot at the pause menu (open it via the capture method), call `/instance/{INST}/sync` and confirm it returns `screen: "pause_menu"`.

Run: `ssh ... POST http://127.0.0.1:8420/instance/$INST/sync`
Expected: `{"screen":"pause_menu", ...}`

- [ ] **Step 4: Commit.**

```bash
git add ow-bot-service/automation/screens.py
git commit -m "feat(bot): detect OW pause menu via SHOW LOBBY signature"
```

### Task 3: Add show_lobby_during_game() and return_to_game()

**Files:**
- Modify: `ow-bot-service/automation/controller.py` (add two methods to `LobbyController`, e.g. right after `create_and_configure`, before `invite_players` at line ~549)

- [ ] **Step 1: Add the two methods.** Use the Show Lobby click token and ESC count from Task 1 (replace `"SHOW LOBBY"` and the loop bound if capture differs):

```python
    async def show_lobby_during_game(self) -> bool:
        """From a live match, open the pause menu and click SHOW LOBBY to reach
        the lobby roster (where INVITE is available). Returns True on success.

        The bot is a spectator, so this only moves the bot's own client - the
        match keeps running for everyone else.
        """
        await self._focus()
        await press_key("escape")
        await asyncio.sleep(T.NAV_AFTER_ESC)
        if self.detector.detect_screen(retries=2) != Screen.PAUSE_MENU:
            log.warning("[%s] Pause menu not detected after ESC", self.instance.id)
            # Close whatever opened so we don't strand the client.
            await press_key("escape")
            await asyncio.sleep(T.NAV_AFTER_ESC)
            return False
        if not await click_text("SHOW LOBBY", self.detector, retries=3):
            log.warning("[%s] SHOW LOBBY not found in pause menu", self.instance.id)
            await press_key("escape")
            await asyncio.sleep(T.NAV_AFTER_ESC)
            return False
        await asyncio.sleep(T.NAV_AFTER_EXIT)
        if not self.detector.wait_for_text("INVITE", timeout=8.0, poll=1.0):
            log.warning("[%s] Lobby roster not visible after SHOW LOBBY", self.instance.id)
            return False
        # Reaching the lobby proves OW is responsive. Reset the health watchdog's
        # failure counter so the UNKNOWN frames of the pause menu / roster do not
        # push it toward the 10-failure kill (see EDGE CASE in Task 1). The
        # focus_lock held by /step already blocks the watchdog DURING the invite;
        # this clears any failures that accrued BEFORE it.
        try:
            from automation.scheduler import scheduler
            ht = scheduler._health_tasks.get(self.instance.id)
            if ht:
                ht.consecutive_failures = 0
        except Exception:
            pass
        log.info("[%s] Reached lobby roster during live match", self.instance.id)
        return True

    async def return_to_game(self) -> None:
        """ESC back to the spectator view. Deliberately does NOT use navigate_to,
        which would EXIT the custom game when starting from the lobby.
        """
        await self._focus()
        for _ in range(3):
            await press_key("escape")
            await asyncio.sleep(T.NAV_AFTER_ESC)
            s = self.detector.detect_screen(retries=1)
            # In-game HUD reads UNKNOWN with no INVITE; the roster shows INVITE and
            # the pause menu is PAUSE_MENU. Stop once neither lobby UI is up.
            if s != Screen.PAUSE_MENU and not self.detector.find_text("INVITE", retries=0):
                return
        log.warning("[%s] return_to_game: still on a menu after ESCs", self.instance.id)
```

- [ ] **Step 2: Deploy + live-verify both methods.** Copy `controller.py` to the box, restart the task. With the instance in a live match, exercise via a temporary REPL-free check: call the existing `navigate` step is not suitable; instead verify indirectly in Task 5's end-to-end. For now confirm the file imports cleanly:

Run: `ssh ... "C:\ow-bot-service\.venv\Scripts\python.exe -c \"import sys; sys.path.insert(0, r'C:/ow-bot-service'); import automation.controller; print('IMPORT OK')\""`
Expected: `IMPORT OK`

- [ ] **Step 3: Commit.**

```bash
git add ow-bot-service/automation/controller.py
git commit -m "feat(bot): add show_lobby_during_game and return_to_game"
```

### Task 4: Make invite_players self-aware about live matches

**Files:**
- Modify: `ow-bot-service/automation/controller.py` `invite_players` (lines 550-614)

- [ ] **Step 1: Replace the method.** Swap the unconditional `await self.navigate_to(Screen.LOBBY)` preamble for an in-game-aware one, and wrap the invite work in try/finally so we always return to the match. Replace the whole `invite_players` method body with:

```python
    async def invite_players(
        self,
        players: list[tuple[int, str | None, int]],
        *,
        join_timeout: int = 60,
        poll_interval: int = 10,
        max_reinvites: int = 1,
    ) -> InviteResult:
        result = InviteResult(total=len(players))
        self._clear_invite_cache()

        # Reach the lobby roster. Pre-game we navigate the menu tree to LOBBY.
        # During a live match the menu tree can't reach it: the bot (a spectator)
        # opens the pause menu and clicks SHOW LOBBY, then returns to the
        # spectator view afterwards. Non-disruptive: only the bot's client moves.
        in_game = self.instance.state.value == "in_game"
        if in_game:
            if not await self.show_lobby_during_game():
                log.error("[%s] Could not reach lobby from live match", self.instance.id)
                await self.return_to_game()
                result.failed_invites = [uid for uid, tag, _ in players if tag]
                return result
        else:
            await self.navigate_to(Screen.LOBBY)

        try:
            valid = [(uid, tag, team) for uid, tag, team in players if tag]
            no_tag = [uid for uid, tag, _ in players if not tag]
            if no_tag:
                log.warning("[%s] Skipping %d players with no BattleTag", self.instance.id, len(no_tag))
                result.missing_tags = no_tag

            valid.sort(key=lambda p: p[2])
            expected_count = len(valid)
            log.info("[%s] Inviting %d players", self.instance.id, expected_count)

            pending = list(valid)
            for round_num in range(1 + max_reinvites):
                if round_num > 0:
                    log.info("[%s] Re-invite round %d for %d remaining", self.instance.id, round_num, len(pending))

                for i, (user_id, battle_tag, team) in enumerate(pending):
                    try:
                        await self._invite_one_player(battle_tag, team)
                        log.info("[%s] Invited %s to team %d (%d/%d)", self.instance.id, battle_tag, team, i + 1, len(pending))
                    except NavigationError as e:
                        log.error("[%s] Failed to invite %s: %s", self.instance.id, battle_tag, e)
                        if user_id not in result.failed_invites:
                            result.failed_invites.append(user_id)
                        continue

                    dialog = await self._dismiss_blocking_dialog()
                    if dialog and "invit" in dialog:
                        log.warning(
                            "[%s] Invite to %s appears refused (%s)",
                            self.instance.id, battle_tag, dialog,
                        )
                        if user_id not in result.failed_invites:
                            result.failed_invites.append(user_id)

                # In a live match a spectator does not register as a filled team
                # slot, so skip the join-wait and do a single round.
                if in_game:
                    break

                joined_count = await self._wait_for_players(expected_count, join_timeout, poll_interval)
                result.joined = joined_count

                if joined_count >= expected_count:
                    log.info("[%s] All %d players joined!", self.instance.id, expected_count)
                    break

                if round_num >= max_reinvites:
                    result.timed_out = [uid for uid, _, _ in pending]
        finally:
            if in_game:
                await self.return_to_game()

        log.info(
            "[%s] Invite phase: %d/%d joined, %d timed out, %d failed, %d no tag",
            self.instance.id, result.joined, result.total,
            len(result.timed_out), len(result.failed_invites), len(result.missing_tags),
        )
        return result
```

- [ ] **Step 2: Import-check.**

Run: `ssh ... "C:\ow-bot-service\.venv\Scripts\python.exe -c \"import sys; sys.path.insert(0, r'C:/ow-bot-service'); import automation.controller; print('IMPORT OK')\""`
Expected: `IMPORT OK`

- [ ] **Step 3: Commit.**

```bash
git add ow-bot-service/automation/controller.py
git commit -m "feat(bot): invite_players opens lobby via pause menu during live match"
```

### Task 5: Deploy and end-to-end live verification (bot)

**Files:** none.

- [ ] **Step 1: Deploy all bot changes + restart.** Copy `screens.py` and `controller.py` to `C:\ow-bot-service\automation\`, then restart via OWBotAPI (end task, kill python, run task). Verify `/health` ok.

- [ ] **Step 2: With an instance in a live match, fire the invite step** for a throwaway tag and watch it do the dance:

Run: `ssh ... "powershell ... Invoke-WebRequest -Method POST -Uri http://127.0.0.1:8420/instance/$INST/step -Headers @{'X-Bot-Secret'=$s;'Content-Type'='application/json'} -Body '{\"command\":\"invite_players\",\"players\":[{\"userId\":0,\"battleTag\":\"Tester#1234\",\"team\":0}]}'"`
Expected: HTTP 200 with an `invite_players` result body.

- [ ] **Step 3: Confirm from the log** that it opened the pause menu, showed the lobby, sent the invite, and returned:

Run: `ssh ... "powershell -Command \"Get-Content C:\ow-bot-service\service.log -Tail 25\""`
Expected: lines for "Reached lobby roster during live match", an invite, then a return (no EXIT/leave-game). Confirm via `/instance/$INST/sync` that the instance is back to `unknown` (in-game HUD), i.e. it did NOT exit the custom game.

- [ ] **Step 4: No code commit** (verification only). If a tweak was needed (ESC count, token), amend the relevant task's file and re-commit there.

---

## Phase 2 - Website (this repo)

### Task 6: Allow invites during a live match (decideSpectatorInvite)

**Files:**
- Modify: `tests/int/pug-spectators.int.spec.ts` (lines 6, 18-22)
- Modify: `src/pug/spectators.ts` (lines 6, 8-22)

- [ ] **Step 1: Update the test to the new desired behavior (failing first).** In `tests/int/pug-spectators.int.spec.ts`, replace the `IN_GAME` constant and its loop (lines 6 and 18-22) with split live/after-game expectations:

```ts
  const LIVE = ['game_started']
  const PENDING_AFTER = ['game_ended']
```

```ts
  for (const status of LIVE) {
    it(`INVITE_NOW when status=${status} (live match) with instance`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('INVITE_NOW')
    })
    it(`KEEP_PENDING when status=${status} but no instance`, () => {
      expect(decideSpectatorInvite(status, null)).toBe('KEEP_PENDING')
    })
  }

  for (const status of PENDING_AFTER) {
    it(`KEEP_PENDING when status=${status}`, () => {
      expect(decideSpectatorInvite(status, 'inst-1')).toBe('KEEP_PENDING')
    })
  }
```

- [ ] **Step 2: Run the test, verify it FAILS.**

Run: `npx vitest run --config ./vitest.config.mts tests/int/pug-spectators.int.spec.ts -t decideSpectatorInvite`
Expected: FAIL - `game_started` currently returns `PENDING_IN_GAME`, not `INVITE_NOW`.

- [ ] **Step 3: Update `decideSpectatorInvite`.** In `src/pug/spectators.ts` replace lines 6-22 with:

```ts
export type SpectatorInviteAction = 'INVITE_NOW' | 'KEEP_PENDING'

const INVITABLE_STATUSES = ['lobby_created', 'invites_sent', 'players_joining']
// Match underway: the bot (a spectator) can invite mid-game via the pause-menu
// Show Lobby flow. 'game_ended' is the between-state, not a live lobby, so it
// stays pending until the lobby is up again or an admin invites manually.
const LIVE_STATUSES = ['game_started']

// INVITE_NOW: we have an instance and the OW lobby is invitable (pre-game) or a
// match is live (in-game invite). KEEP_PENDING: not ready - invite later.
export function decideSpectatorInvite(
  botStatus: string | null,
  botInstanceId: string | null,
): SpectatorInviteAction {
  if (!botInstanceId || !botStatus) return 'KEEP_PENDING'
  if (INVITABLE_STATUSES.includes(botStatus)) return 'INVITE_NOW'
  if (LIVE_STATUSES.includes(botStatus)) return 'INVITE_NOW'
  return 'KEEP_PENDING'
}
```

- [ ] **Step 4: Run the test, verify it PASSES.**

Run: `npx vitest run --config ./vitest.config.mts tests/int/pug-spectators.int.spec.ts -t decideSpectatorInvite`
Expected: PASS.

- [ ] **Step 5: Remove the now-dead PENDING_IN_GAME branch.** Dropping it from the union (Step 3) makes the `addSpectator` branch that references it a type error, so remove it in the same commit. In `addSpectator`, delete the `else if (action === 'PENDING_IN_GAME') { ... }` block (lines 170-175). The preceding `if (action === 'INVITE_NOW' ...)` block stays; its tail becomes:

```ts
    } catch (err: any) {
      await prisma.pugLobbySpectator.update({
        where: { lobbyId_battleTag: { lobbyId, battleTag: tag } },
        data: { status: 'FAILED', note: (err?.message ?? 'invite failed').slice(0, 300) },
      })
    }
  }

  return { ok: true, spectators: await enrichSpectators(lobbyId) }
```

- [ ] **Step 6: Type-check (no `PENDING_IN_GAME` references remain).**

Run: `npx tsc --noEmit`
Expected: no errors referencing `PENDING_IN_GAME`.

- [ ] **Step 7: Commit.**

```bash
git add src/pug/spectators.ts tests/int/pug-spectators.int.spec.ts
git commit -m "feat: invite spectators during a live match (game_started)"
```

### Task 7: Add inviteSpectatorById service function

**Files:**
- Modify: `src/pug/spectators.ts` (add a new exported function)

- [ ] **Step 1: Add `inviteSpectatorById`.** Append this exported function to `src/pug/spectators.ts` (after `invitePendingSpectators`):

```ts
// Force-invite a single spectator row by id, regardless of match state.
// Backs the manual "Invite now" button. Returns the enriched list.
export async function inviteSpectatorById(
  lobbyId: number,
  specId: number,
): Promise<EnrichedSpectator[]> {
  if (!botConfigured()) return enrichSpectators(lobbyId)
  const spec = await prisma.pugLobbySpectator.findFirst({ where: { id: specId, lobbyId } })
  if (!spec) return enrichSpectators(lobbyId)
  const lobby = await prisma.pugLobby.findUnique({ where: { id: lobbyId } })
  if (!lobby?.botInstanceId) {
    await prisma.pugLobbySpectator.update({
      where: { id: spec.id },
      data: { status: 'FAILED', note: 'No bot instance assigned to this lobby' },
    })
    return enrichSpectators(lobbyId)
  }
  try {
    const res = await inviteSpectator(lobby.botInstanceId, spec.battleTag)
    if (res.ok) {
      await prisma.pugLobbySpectator.update({
        where: { id: spec.id },
        data: { status: 'INVITED', invitedAt: new Date(), note: null },
      })
    } else {
      const text = await res.text().catch(() => '')
      await prisma.pugLobbySpectator.update({
        where: { id: spec.id },
        data: { status: 'FAILED', note: `Bot error: ${text}`.slice(0, 300) },
      })
    }
  } catch (err: any) {
    await prisma.pugLobbySpectator.update({
      where: { id: spec.id },
      data: { status: 'FAILED', note: (err?.message ?? 'invite failed').slice(0, 300) },
    })
  }
  return enrichSpectators(lobbyId)
}
```

- [ ] **Step 2: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/pug/spectators.ts
git commit -m "feat: add inviteSpectatorById service function"
```

### Task 8: Manual invite endpoint

**Files:**
- Create: `src/app/api/pug/lobby/[id]/spectators/[specId]/invite/route.ts`

- [ ] **Step 1: Create the route** (admin-gated like the existing spectators route):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { isPugAdmin, isProductionStaff } from '@/access/roles'
import { inviteSpectatorById } from '@/pug/spectators'

type Params = { params: Promise<{ id: string; specId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const args = { req: { user } } as any
  if (!isPugAdmin(args) && !isProductionStaff(args)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, specId } = await params
  const lobbyId = parseInt(id, 10)
  const sid = parseInt(specId, 10)
  if (isNaN(lobbyId) || isNaN(sid)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const spectators = await inviteSpectatorById(lobbyId, sid)
  return NextResponse.json({ spectators })
}
```

- [ ] **Step 2: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/app/api/pug/lobby/[id]/spectators/[specId]/invite/route.ts
git commit -m "feat: add per-spectator manual invite endpoint"
```

### Task 9: "Invite now" button in SpectatorPanel

**Files:**
- Modify: `src/components/PugLobbies/index.tsx` (`SpectatorPanel`, lines 112-139)

- [ ] **Step 1: Add an `inviteNow` handler.** In `SpectatorPanel`, immediately after the `mutate` function (after line 127), add:

```ts
  async function inviteNow(specId: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/pug/lobby/${lobbyId}/spectators/${specId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { await alert({ message: data.error || 'Failed', variant: 'danger' }); return }
      onChange(data.spectators)
    } finally {
      setBusy(false)
    }
  }
```

- [ ] **Step 2: Add the button to each spectator row.** In the `spectators.map` row (line 137), insert an "Invite now" button before the existing Remove (`x`) button, shown only for `PENDING`/`FAILED`:

```tsx
          <SpectatorStatusBadge status={s.status} note={s.note} />
          {(s.status === 'PENDING' || s.status === 'FAILED') && (
            <button className="ps-btn ps-btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} disabled={busy} onClick={() => inviteNow(s.id)} title="Invite this spectator to the OW lobby now (works mid-match)">Invite now</button>
          )}
          <button className="ps-btn ps-btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} disabled={busy} onClick={() => mutate('DELETE', { id: s.id })} title="Remove from list (does not kick from the live OW lobby)">x</button>
```

- [ ] **Step 3: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/components/PugLobbies/index.tsx
git commit -m "feat: add Invite now button to spectator panel"
```

### Task 10: Endpoint auth test + full verification

**Files:**
- Modify: `tests/int/pug-spectators.int.spec.ts` (auth-gating describe block, after line 50)

- [ ] **Step 1: Add an auth-gating test for the new endpoint.** In the `Spectators API - auth gating` describe, add:

```ts
  it('POST /api/pug/lobby/1/spectators/1/invite - 401 without auth', async () => {
    const res = await fetch(`${BASE}/api/pug/lobby/1/spectators/1/invite`, {
      method: 'POST', headers: h,
    })
    expect(res.status).toBe(401)
  })
```

- [ ] **Step 2: Run the full spectators int suite** (requires the dev server running on :3000 for the fetch tests; the `decideSpectatorInvite` tests run regardless).

Run: `npm run test:int -- tests/int/pug-spectators.int.spec.ts`
Expected: PASS (pure tests pass always; the auth fetch tests pass when the dev server is up).

- [ ] **Step 3: Manual UI check.** With the dev app running and a lobby whose match is live, open the PUG dashboard spectator panel, add a spectator (auto path) and click "Invite now" on a pending one (manual path). Confirm the bot performs the in-game invite and the badge flips to INVITED (or FAILED with a readable note).

- [ ] **Step 4: Commit.**

```bash
git add tests/int/pug-spectators.int.spec.ts
git commit -m "test: auth-gate the manual spectator invite endpoint"
```

---

## Self-review notes (coverage of the spec)

- Bot self-aware `invite_players` -> Tasks 2-4. Show Lobby / return-to-game without EXIT+YES -> Task 3. New screen signature -> Task 2. Live capture for signatures -> Task 1.
- Website flip `game_started` to invite -> Task 6. Manual "Invite now" (button + endpoint + service fn) -> Tasks 7-9. Auto-on-approval -> already routed through `addSpectator` -> `decideSpectatorInvite` (Task 6 makes it fire live).
- Error handling: bot returns to game in `finally`; failed invites -> FAILED + note (existing website behavior, Task 7 service fn mirrors it).
- Deploy is the bot SSH procedure (Tasks 2-5 deploy steps); website CI/CD on push to main after verification.
- `game_ended` decision: KEEP_PENDING (Task 6), per spec open item.
