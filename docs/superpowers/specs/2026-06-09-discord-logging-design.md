# Discord Server Logging (carlbot replacement) - Design

Date: 2026-06-09
Status: Approved (pending spec review)

## Goal

Replace carlbot, the last bot kept around purely for its logging features, with logging
built into our own discord.js bot. The result must work across every server the bot is
in (hub + region spokes), be trustworthy (no silent gaps), and beat carlbot where it is
cheap to do so. Voice activity logging is the only carlbot logging feature we do not need.

## Background / current state

- One discord.js bot, single token, already a member of every server. `client.guilds.cache`
  holds them all. Gateway events from every server arrive on one connection.
- `DiscordServers` Payload collection (`src/collections/DiscordServers.ts`) is the registry
  of servers (label, guildId, region, isPrimary, active). `src/discord/serverRegistry.ts`
  resolves guild ids.
- The gateway client (`src/discord/bot.ts`) is **lazy-initialized inside the Next/Payload
  request lifecycle**. It goes dark after every deploy until the first Payload-booting
  request, and its uptime is tied to the website. Current intents: `Guilds`, `GuildMembers`.
- Each server already has split log channels: `message-log`, `join-leave-log`, `member-log`,
  `server-log`, `voice-log`.

The lazy-init model is acceptable-ish for slash commands (a missed command is visible and
gets pinged) but unacceptable for logging, where every gap is silent and invisible. Fixing
this is the real cost of the project; the logging code itself is small.

## Architecture

### Dedicated always-on bot process

Move the discord.js gateway client out of the Next request lifecycle into its own
long-lived process, deployed as a separate container in the same docker stack on elmt.gg
with `restart: unless-stopped`, same repo and same push-to-main CI/CD (no new manual ops).

- discord.js auto-reconnects, so network blips self-heal instead of leaving log gaps.
- The Next app keeps doing its REST posting via `@discordjs/rest` (already used throughout
  `src/app/api/discord/**`); it stops owning the gateway connection.
- One gateway connection per token: consolidating into a single always-on process also
  removes the latent risk of multiple Next workers fighting over the same token.
- Side benefit: this fixes the existing "slash commands dark after deploy" problem, which
  now affects every spoke server because boot loops over all servers to register commands.

The slash-command interaction handling and per-guild command registration move into this
process (or are triggered from it), so there is exactly one owner of the gateway.

### Multi-server routing

Single bot, single connection, listens globally. Every handler reads `event.guild.id`,
looks up the matching `DiscordServers` row, and posts to that server's configured log
channel for the event category. Servers with logging disabled or unconfigured channels are
skipped. New servers (e.g. from the clone tool) start logging the moment their channels are
configured - no code change.

## Configuration (extend `DiscordServers`)

Add per-row fields:

- `enableLogging` (checkbox, default false)
- `messageLogChannelId` (text)
- `joinLeaveLogChannelId` (text)
- `memberLogChannelId` (text)
- `serverLogChannelId` (text)

We deliberately do NOT add a voice log channel. Channels map to the server's existing
taxonomy. A blank channel id for a category means "do not log that category for this server."

Migration: add columns to `discord-servers` (manual apply to dev + prod per project
convention, `ssh ubuntu@elmt.gg`, container `elemental-website-postgres-1`).

## Event coverage and routing

| Channel | Events |
|---|---|
| `message-log` | `messageUpdate` (edit), `messageDelete`, `messageDeleteBulk` (purge, grouped) |
| `join-leave-log` | `guildMemberAdd`, `guildMemberRemove` |
| `member-log` | `guildMemberUpdate` (role changes, nickname changes, timeout add/remove) |
| `server-log` | `channelCreate`, `channelDelete`, `channelUpdate` (incl. category/parent moves), role create/update/delete, server-setting changes, the `guildAuditLogEntryCreate` who-did-what feed |
| (none) | voice activity - deliberately skipped |

### Deliberately skipped

- Voice activity (join/move/leave voice channels).
- Raw within-category position reorders. Reordering one channel renumbers many, producing
  a burst of `channelUpdate` position events that Discord's own audit log attributes poorly.
  Category/parent **moves** ARE logged (clean signal + actor); pure drag-reordering within a
  list is treated as noise. (Same blind spot carlbot has - a Discord platform limitation.)

## Identity display

- **Primary: Discord mention** (`<@userId>`) so it is clickable in Discord and pops the
  native profile card, exactly like carlbot's `@user`. Also include the raw user id and tag
  in the embed for cases where the user is no longer in the server.
- **Secondary (enabled): website profile link.** When a matching `People` record exists
  (lookup by Discord id), append a small link line to the website profile. The Discord
  mention stays primary; this is an extra, not a replacement.

## Enhancements (all approved)

1. **Full actor attribution.** Join the audit log to every applicable event so deletes,
   kicks, bans, role and nickname changes, and channel changes show WHO did it, not just
   that it happened. Use the realtime `guildAuditLogEntryCreate` event and correlate with
   the corresponding gateway event by target id + timestamp. Where correlation is
   unavailable, log the event without an actor rather than guessing.
2. **New-account-age flag on join.** On `guildMemberAdd`, compute account age from the user
   id snowflake and surface a warning when it is below a threshold (default 7 days,
   configurable) to catch raid/bot/throwaway accounts.
3. **Invite-source tracking.** Cache each guild's invite-use counts (refresh on `ready`,
   `inviteCreate`, `inviteDelete`); on `guildMemberAdd`, diff to find which invite was used
   and log the invite code + its creator. Requires the `GuildInvites` intent and Manage
   Server permission. If the diff is ambiguous (e.g. vanity URL, multiple changed), log
   "invite source unknown" rather than guessing.
4. **Rejoin detection.** On join, report whether this user has joined this server before
   ("Nth time joining, last left <date>"). Requires the small persistence table below.

### Table stakes (built in, not optional)

- Before -> after diffs: message edits show old vs new content; role changes show
  `+added / -removed`; nickname shows `old -> new`.
- Bulk delete / purge collapsed into one grouped entry (count + channel + actor).
- Timeout entries show duration and (via attribution) who applied it.

## Storage

Mostly channels-only, with a clean `event -> format -> sink` layering so a full searchable
DB sink can be added later without a rewrite. Two features need minimal persistence now:

- **Member event history** (for rejoin detection): a small collection/table keyed by
  `(guildId, userId)` recording `type` (join/leave) and timestamp. On join, count prior
  joins and find the last leave. This is also the seed of the future searchable audit feed.
- **Invite-count cache** (for invite-source tracking): in-memory per guild, rebuilt on
  `ready`. No DB needed; tolerant of restarts (a restart just means the next few joins may
  log "invite source unknown" until the cache warms - acceptable).

No full audit-feed DB sink and no dashboard view in this phase.

Migration: new collection for member events (manual apply to dev + prod; remember the
`payload_locked_documents_rels` `<collection>_id` column when adding a Payload collection).

## Intents and permissions

Enable in the dev portal and add to the client:

- `GuildMessages` + `MessageContent` (privileged) - message edit/delete content
- `GuildModeration` - ban events
- `GuildInvites` - invite-source tracking
- `GuildMembers` (already enabled, privileged) - join/leave/member updates

Intents are app-global, so they cover all servers at once. We are well under the 100-server
threshold that would require Discord verification for privileged intents. The bot needs
View Audit Log and Manage Server permissions in each server for attribution and invite
tracking.

## Reliability

- `restart: unless-stopped` plus discord.js built-in reconnect for self-healing.
- Posting failures (missing channel, lost permission) are caught per-event and logged to the
  existing error logger; one bad server never blocks others.
- Audit-log correlation uses the realtime `guildAuditLogEntryCreate` event, not delayed
  polling, so attribution is timely.

## Testing

- Pure formatters/helpers are unit-tested: message/role/nickname diffing, account-age from
  snowflake, invite-source resolution from a before/after count map, rejoin summary from a
  member-event list. Handlers stay thin wrappers that call these.
- Channel routing (guild id -> DiscordServers row -> channel id) is a pure, tested function.

## Out of scope

- Voice activity logging.
- Within-category channel reorder tracking.
- Full searchable audit-feed DB sink and admin dashboard view (deferred; member-event table
  is the seed).
- Per-server bot tokens (single token, multi-guild stays).
- Region-aware anything beyond per-server channel config.
