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
- The gateway client (`src/discord/bot.ts`) runs **inside the Next/Payload web process**.
  It is started at container boot: `src/instrumentation.ts` self-pings `/api/people/me` in
  all environments, which triggers Payload `onInit` (`src/payload.config.ts:369`), which
  connects the gateway and registers slash commands. So the bot comes up on its own after a
  deploy - the earlier "stays dark until a human pings it" note is stale. Current intents:
  `Guilds`, `GuildMembers`.
- ~20 web routes read the gateway cache via `ensureDiscordClient()` (e.g.
  `client.guilds.cache`) - server manager, registry resolution, provisioning, channel/role
  ops. This coupling is what makes the process split non-trivial (see Architecture).
- Each server already has split log channels: `message-log`, `join-leave-log`, `member-log`,
  `server-log`, `voice-log`.

Why this still is not good enough for logging: the bot's process restarts whenever the
*website* does - every deploy, every `uncaughtException` (instrumentation calls
`process.exit(1)`), every OOM (1G shared cap), every event-loop stall that makes Discord
drop the bot as a zombie. Each full restart starts a **new gateway session**, and Discord
does NOT replay events missed across a new session - so each restart is a silent,
unrecoverable hole in the audit trail. Brief network blips are fine (the client RESUMEs and
Discord replays the buffer); the enemy is full process restarts. Decoupling the bot from the
website is therefore the real cost of the project; the logging code itself is small.

## Architecture

### Dedicated always-on bot process (zero-gap goal)

Move the discord.js gateway client out of the Next/Payload web process into its own
long-lived container in the same docker stack on elmt.gg, `restart: unless-stopped`, same
repo and same push-to-main CI/CD (no new manual ops - it is a second service built from the
same image with a different command). Decision (2026-06-09): the user wants near-zero-gap
logging, so we pay for the split rather than accept per-deploy gaps.

- **One gateway, owned solely by the bot process.** A bot token supports only one unsharded
  gateway connection, so the web process must STOP owning a gateway client. All gateway-
  cache reads in web routes (~20 `ensureDiscordClient()` call sites) migrate to REST via
  `@discordjs/rest` (already a dependency) or to the `DiscordServers` registry. This route
  migration is the bulk of the infrastructure work and is in scope.
- **The bot process owns:** gateway connection, slash-command interaction handling, per-guild
  command registration, and all logging event handlers.
- **Gap behaviour:** network blips are covered by gateway RESUME (Discord replays the buffer)
  - gap-free. The only remaining gap is when the bot's OWN container restarts (i.e. a bot-code
  deploy, which is rare). Per decision (2026-06-09) we ACCEPT that rare one-restart gap and do
  NOT build a deploy-handoff/overlap now. A handoff (start new instance, let it connect, then
  stop old) is a documented future option if zero-gap-across-bot-deploys is ever needed.
- **Decoupling is the point:** website deploys, `uncaughtException` exits, OOM, and event-loop
  stalls no longer restart the gateway, because the bot is a separate process with its own
  memory budget and CPU.

Because this is a large, separable piece of work, the implementation is split into two
plans (each independently shippable and testable):
1. **Infrastructure plan:** stand up the dedicated bot process and migrate web routes off the
   gateway cache to REST. Ships value alone (decoupled, self-healing bot; no logging yet).
2. **Logging plan:** config fields, routing, event handlers, enhancements, persistence -
   built on top of the dedicated process.

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
- `memberLogChannelId` (text) - moderation-relevant member changes only (roles, nickname, timeout)
- `profileLogChannelId` (text, optional) - cosmetic profile changes (avatar, username, global
  display name), split out so they never bury role changes in `member-log`. Blank = not logged.
- `serverLogChannelId` (text)

We deliberately do NOT add a voice log channel. Channels map to the server's existing
taxonomy. A blank channel id for a category means "do not log that category for this server."

Migration: add columns to `discord-servers` (manual apply to dev + prod per project
convention, `ssh ubuntu@elmt.gg`, container `elemental-website-postgres-1`).

## Event coverage and routing

| Channel | Events |
|---|---|
| `message-log` | `messageUpdate` (edit), `messageDelete`, `messageDeleteBulk` (purge, grouped); deleted-attachment **metadata** captured (see below), never the file |
| `join-leave-log` | `guildMemberAdd`, `guildMemberRemove` |
| `member-log` | `guildMemberUpdate` - role changes, nickname changes, timeout add/remove (moderation-relevant only; cosmetic profile changes are routed elsewhere) |
| `profile-log` (optional) | avatar, username, and global display-name changes (`guildMemberUpdate` per-guild avatar + `userUpdate` global). Split out so they never bury role changes. Only logged when `profileLogChannelId` is set. |
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

### Deleted-attachment handling (metadata only - NO re-hosting)

When a message with attachments is deleted, we capture **metadata only**: filename,
content-type, size, dimensions (when available), the original (now-expired) CDN URL, who
posted it, and who deleted it. We do NOT download or re-host the file.

Rationale: re-hosting a deleted attachment would make our infrastructure the host of that
content. For genuinely illegal material (e.g. CSAM), possessing, storing, or redistributing
it is a crime regardless of intent, and re-posting it into a log channel could spread it
further. Metadata preserves the moderation trail ("an image `x.png` was posted by @A and
deleted by @B") with zero illegal-content exposure. Hash-based matching against known-bad
lists is explicitly out of scope for this phase.

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

- Dedicated bot container with `restart: unless-stopped`. Gateway RESUME covers brief
  disconnects gap-free (Discord replays the buffered events on resume); discord.js handles
  reconnect/resume automatically.
- The only accepted gap is a full restart of the bot container (a bot-code deploy), which is
  rare. No deploy-handoff in this phase (documented future option).
- Decoupled from the website: website deploys, `uncaughtException` exits, OOM, and event-loop
  stalls no longer restart the gateway.
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
- Deploy-handoff / overlap for zero-gap across bot-code deploys (accepted rare gap for now;
  documented future option).
- Region-aware anything beyond per-server channel config.
