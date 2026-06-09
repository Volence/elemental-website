# Slash Commands in Region Servers (Sub-project C) - Design

**Date:** 2026-06-08
**Status:** Implemented and verified working (2026-06-08). Region commands register to active region servers; verified /availability appears in the test region server while /pug + /calendar stay primary-only. Fixed an onInit getPayload deadlock found in live boot. Code-only, no migration.
**Parent:** [Multi-Server Discord Architecture](./2026-06-08-multi-server-discord-architecture-design.md)
**Follows:** [Clone Tool (B)](./2026-06-08-discord-clone-tool-design.md) and [Multi-Server Registry (A)](./2026-06-08-multi-server-registry-design.md) - both built and deployed.

## Purpose

Make the bot's org-data slash commands (`/availability`, `/team info`, `/matches`,
etc.) work in registered region servers, not just the primary. Today every command
is registered to the primary guild only, so region-server members see no commands.
Sub-project A gave us the `DiscordServers` registry; C uses it to register the
appropriate command set to each region server.

This is small because the hard parts are already solved: command handlers route
purely by command name with no guild gating (so they already process interactions
from any guild), almost every command replies in the channel where it is invoked
(`editReply`, guild-agnostic), and schedule/availability/calendar *publishing*
already posts cross-guild via per-team thread ids (`client.channels.fetch`). C is
essentially "register the right commands to each registered server."

## Command bucketing

Two commands are **primary-only**:

```
const PRIMARY_ONLY_COMMANDS = ['pug', 'calendar']
```

- `pug` - the PUG system is single-server by an earlier decision (creates voice
  channels and posts to fixed primary feed channels).
- `calendar` - its "publish" path posts to the fixed primary calendar channel
  (`DISCORD_CALENDAR_CHANNEL_ID`, `commands/calendar.ts`), so from a region server it
  would post to the main server.

`buildCommands()` already builds the full set. Two derived lists:

- **Primary set** = the full set (unchanged from today).
- **Region set** = the full set minus `PRIMARY_ONLY_COMMANDS`.

Everything in the region set replies in-place / uses org-wide data, so it behaves
correctly in any guild: `/team info|matches|history|season|faceit`, `/matches`,
`/casting-sheet`, `/matches-post`, `/daily-results`, `/availability`, `/schedulepoll`,
`/tka`.

## Registration mechanism

`registerCommands()` changes from registering to the single primary guild to a loop:

1. Register the **primary set** to the primary guild (`DISCORD_GUILD_ID`) - exactly as
   today.
2. Register the **region set** to **each active, non-primary `DiscordServers` row**.

Each guild's registration is wrapped in its own `try/catch` so one failing guild
(e.g. missing scope) does not block the others; failures are logged with the guild
id/label. Registration is idempotent - Discord's
`PUT applicationGuildCommands(clientId, guildId)` replaces that guild's command set
on each call, so re-running is safe.

## When registration runs

- **At bot boot:** `onInit` calls `registerCommands()`, which now loops the registry,
  re-syncing every server on each restart.
- **On new-server registration:** the `POST /api/discord/servers/register` route
  triggers registration of the region set to the newly-registered guild, so a server
  gets its commands without a restart.
- **Deactivation:** deactivating a server does not auto-remove its commands in v1
  (documented limitation). An unregister step (`PUT` an empty command array to that
  guild) can be added later if it matters.

## The `applications.commands` scope (operational requirement)

Guild slash-command registration requires the bot to have been invited to the guild
with the **`applications.commands`** OAuth scope, not just `bot`. The clone-test
invite URL used `scope=bot&permissions=8` (no `applications.commands`), so existing
region servers may reject registration until re-invited.

C therefore:

- Updates any bot-invite URL generated in the flow to
  `scope=bot%20applications.commands&permissions=...`.
- Catches per-guild registration failures and surfaces them rather than swallowing
  them: logged, and shown in the **Servers** tab as a per-server command-registration
  status (e.g. "commands: ok" / "commands: failed - re-invite with
  applications.commands"). This needs a small route that reports/triggers
  registration status per registered guild, consumed by the Servers tab.

Operationally: existing region servers get re-authorized once with the updated URL;
new region servers get the scope from the start.

## New pieces to build

- `PRIMARY_ONLY_COMMANDS` constant + a pure `regionCommandSet(fullCommands)` filter
  (unit-tested).
- `registerCommands()` reworked to loop primary + active region servers, per-guild
  try/catch, returning a per-guild result (ok/failed + message).
- A `registerCommandsForGuild(guildId, which: 'primary' | 'region')` helper (or
  equivalent) so the register route can register one guild on demand.
- `POST /api/discord/servers/register` triggers region-set registration for the new
  guild and records/returns the result.
- A way for the **Servers** tab to show per-server command-registration status (a
  small GET route or a field on the registration response), plus a "re-register
  commands" action.
- Updated bot-invite URL(s) to include `applications.commands`.

## Out of scope

- Per-server command customization (every region server gets the same region set).
- Making `/calendar` publish or PUG multi-server.
- Region-aware ping routing (still out, from the parent).
- Auto-unregister on deactivation (noted limitation).

## Testing

- **Unit test** the region-set filter: region set equals the full set minus `pug` and
  `calendar`; primary set is unchanged.
- **Manual verification:** re-invite the throwaway server with `applications.commands`,
  register it, confirm the region-set commands (esp. `/availability`) appear there and
  `/pug` + `/calendar` do not, and confirm the primary still has the full set. Confirm
  a guild missing the scope shows a clear failed status rather than blocking others.
