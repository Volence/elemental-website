# Multi-Server Registry & Routing (Sub-project A) - Design

**Date:** 2026-06-08
**Status:** Approved
**Parent:** [Multi-Server Discord Architecture](./2026-06-08-multi-server-discord-architecture-design.md)
**Follows:** [Discord Clone Tool (sub-project B)](./2026-06-08-discord-clone-tool-design.md) - built and deployed.

## Purpose

Let the website bot and the admin Server Manager operate on more than one Discord
server. Sub-project B made standing up a region server cheap (clone the bones); A
makes those region servers manageable from the admin panel: a registry of servers
plus a picker that re-points the generic server-management tools at any registered
server. This is the foundation that turns cloned region servers into servers the
staff can actually administer without leaving the website.

## Scope framing

The single `process.env.DISCORD_GUILD_ID` is read in 21 places. They split into two
groups:

- **Generic server management** (gets the picker): the `/api/discord/server/*`
  routes - `structure`, `stats`, `health`, `roles`, `create-channel`,
  `clone-channel`, `rename`, `move`, `delete` - plus `templates/save`,
  `templates/apply`, `provision-team`, and the Threads-listing route.
- **Primary-only** (never changes, keeps reading the env var): PUG voice/lobby
  (`pugVoice`, `lobbyStateMachine`, `pug/lobby`), slash-command registration
  (`commands/register`), bot init (`bot.ts`), the MCP server, and the clone *source*
  (`cloneSource` - always primary by design).

So A is NOT "replace the env var everywhere." It is: a registry, a picker, and a
`serverId` parameter threaded through the generic-management routes. The env var
stays the canonical "primary."

## Out of scope

- Region-aware ping routing (carried over from the parent: PUG stays single-server,
  ringer/scrim player-driven).
- Any region-server-specific tabs beyond the existing set - added later only if a
  concrete need appears.
- Changing the primary-only code paths listed above.

## Design

### 1. Data model - `DiscordServers` collection

A new Payload collection:

| Field | Purpose |
|---|---|
| `label` | Human name, e.g. "Elemental SA". |
| `guildId` | Discord guild ID. Unique. |
| `region` | Optional tag (NA / EMEA / SA / ...). Metadata only for now. |
| `isPrimary` | Marks the main hub. Exactly one row should have this. |
| `active` | Inactive servers do not appear in the picker. |

Admin-gated like the other Discord collections (`isPugAdmin`/`admin` consistent
with `DiscordCloneJobs`). On first boot a seed (a migration plus an idempotent
`onInit` upsert) creates the primary row from `DISCORD_GUILD_ID`, marked
`isPrimary`, `active`. The env var remains canonical for all primary-only code; the
collection is additive - it holds the primary (so the picker can show it as default)
plus the region servers the admin registers.

Adding this collection also requires the matching `discord_servers_id` column on
`payload_locked_documents_rels` (the lesson from B): the migration must include it,
or the admin "locked documents" query errors.

### 2. Registration - auto-detect

A new **"Servers"** tab in the Server Manager:

- A route returns the guilds the bot is currently a member of
  (`client.guilds.cache`), each cross-referenced against `DiscordServers` and marked
  **Registered** or **Unregistered**.
- An unregistered guild has a **Register** action: the admin sets a label + region,
  and it is saved (active).
- Registered servers can be edited or deactivated.
- The `DiscordServers` collection stays editable directly in the Payload admin as a
  fallback.

Because registration is sourced from the bot's actual guild membership, the registry
cannot drift from reality - you can only register servers the bot can reach.

### 3. Server picker + `resolveGuildId`

A **server picker** (dropdown) sits at the top of the Server Manager view, sourced
from the registry's active servers via a `GET /api/discord/servers` route,
defaulting to the primary. The selected server's id is passed as `serverId` to the
scoped routes.

A single helper underpins resolution - **`resolveGuildId(serverId?)`**:

- If `serverId` is given: look it up in `DiscordServers`, confirm it is `active` and
  that the bot is actually a member of that guild, then return its `guildId`.
- If no `serverId` (or it resolves to the primary): return `DISCORD_GUILD_ID`.
- Unknown id / inactive / bot-not-present: return a clear error. Never silently fall
  through to the wrong server.

The generic-management routes gain an optional `serverId` param (query for GETs, body
for POSTs) and call `resolveGuildId` instead of reading the env var directly. Absent
`serverId` resolves to the primary, so every existing caller keeps working unchanged.

### 4. Tab behavior

The picker scopes these tabs to the selected server: **Structure, Stats, Health,
Templates, Threads, Provision Team**.

When a **non-primary** server is selected, the primary-only feature tabs - **Team
Cards, Announcements, Live Roster, Faceit Updates** - are hidden (they are main-hub
features: Twitch rosters, team cards, Faceit). Re-selecting the primary brings them
back. The **Servers** (registration) and **Clone Server** tabs are always available,
since they are cross-server by nature.

### 5. Provision Team & Threads specifics

- **Provision Team**: takes the selected server's guild id via `resolveGuildId`,
  creates the team's roles/category/channels in that guild, and resolves shared staff
  roles by name in that guild (gracefully skipping any the clone did not bring over -
  existing behavior). Known limitation surfaced in the UI: a team record stores a
  single set of Discord ids, so a given team should be provisioned in one server.
- **Threads**: the Threads tab lists the selected server's threads to watch. The
  `threadKeepAlive` service is unchanged - it already fetches threads by their global
  id (`client.channels.fetch(threadId)`) across every guild the bot is in. Watched
  thread records gain a `guildId` so the tab can filter to the selected server (a
  small additive change to that collection + a backfill defaulting existing rows to
  the primary guild).

## New pieces to build

- `DiscordServers` collection + migration (table + `payload_locked_documents_rels`
  column + FK + index), with a primary-row seed.
- `resolveGuildId(serverId?)` helper (one shared module).
- `GET /api/discord/servers` (list active registered servers for the picker),
  `GET /api/discord/bot-guilds` (the bot's current guilds + registration status), and
  `POST /api/discord/servers/register` (upsert a `DiscordServers` row from a chosen
  bot guild: label, region, guildId). The Payload collection API stays as a fallback.
- `serverId` param added to the ~13 generic-management routes, each calling the
  helper.
- Server picker UI + a "Servers" registration tab in `DiscordServerManagerView`, plus
  the non-primary tab-hiding logic.
- `guildId` field added to the watched-threads collection (+ backfill) and the
  Threads tab/route scoped by it.

## Testing

- Unit-test `resolveGuildId` (pure-ish: primary fallback, valid serverId, unknown id,
  inactive, bot-not-member) with the registry lookup mocked.
- Manual verification: register the existing throwaway region server, switch the
  picker to it, confirm Structure/Stats/Health/Templates read *that* server, confirm
  the primary-only tabs hide, provision a test team into it, and confirm primary is
  unaffected when the picker is on primary.
