# Multi-Server Discord Architecture - Design

**Date:** 2026-06-08
**Status:** Approved (architecture overview / vision doc)
**Type:** Overview spec. Each numbered sub-project below gets its own spec -> plan -> build cycle.

## Background

Elemental currently runs a single Discord server for all regions. The long-term
goal is a hub-and-spoke model: the main server stays the staff + global community
hub, and each region we host gets its own spoke server. Spoke servers act as
mini-hubs for region-specific communities (e.g. a South America server for finding
scrims), giving more channel space, better organization, and a place for regional
communities to form.

To make standing up a new region server cheap, we want a tool that clones the
"bones" of the main server (roles, permissions, channel structure) into a new one.
The website bot and the admin Server Manager tools must also learn to operate on
more than one server.

### Current state (as found)

- **One bot client** (`src/discord/bot.ts`): a single `discord.js` Client that logs
  in once. A Discord bot is natively a member of every guild it is invited to, so
  the client itself is not the blocker.
- **A single hardcoded guild**: `process.env.DISCORD_GUILD_ID` is read directly in
  ~15 places - the `/api/discord/server/*` routes, the PUG state machine, and the
  voice/feed services. This is the real obstacle to multi-server.
- **DiscordServerManager**: a Payload global (singleton, no data fields, custom
  React admin view) that drives the single-guild API routes.
- **DiscordCategoryTemplates**: an existing collection that stores channel +
  permission JSON extracted from a source guild. Already most of the foundation for
  "copy the bones," but only knows about one server.
- **Two separate bots**: this website `discord.js` bot (manages servers, roles,
  channels) and the Windows Overwatch automation bot (in-game match automation).
  Only the website bot is relevant here.

## Goal

Move from one Discord server to a hub-and-spoke set of servers. The main server
remains the staff + global community hub and the clone source. Each region gets a
spoke server, cheaply stood up by cloning the main server's bones. The website bot
and admin tools operate on any registered server, not just the hardcoded one.

## Out of scope

- **Region-aware feature routing** (originally "piece 3"). PUG pings stay in the
  main community server; ringer pings and scrim-finding remain player-driven. No
  per-region ping routing for now.
- **Ongoing template sync.** The clone is a one-shot stamp, not a living source of
  truth. Once a region server is stamped it diverges freely and is tidied by hand.
- Copying members, messages, invites, webhooks, third-party integrations, or role
  assignments to people.

## Build order

Each item is its own spec -> plan -> build cycle.

1. **B - Clone tool** (first). Selective one-shot stamp of roles/permissions,
   channel structure, emojis/stickers, and server settings. Takes a target guild ID
   as input, so it does not block on the full registry. Lets us stand up region
   servers immediately and tidy them by hand.
2. **A - Multi-server registry + routing.** Replace the single `DISCORD_GUILD_ID`
   env var with a `DiscordServers` collection; thread a server selector through the
   API routes, services, and the admin Server Manager.
3. **Polish.** Server Manager multi-server switching, per-server health/stats, and
   anything deferred.

The clone tool (B) ships before the full registry (A) because it only needs the
primary server (the source) plus a target guild ID typed in by the admin.

## Data model (the spine)

A new Payload collection, **`DiscordServers`**, that replaces the lone env var:

| Field | Purpose |
|---|---|
| `label` | Human name, e.g. "Elemental SA". |
| `guildId` | The Discord guild ID. |
| `region` | Enum (NA, EMEA, SA, ...). Reserved for later region features. |
| `isPrimary` | Marks the main hub: the clone source and the default fallback. |
| `active` | Bot ignores inactive entries. |

The existing `DISCORD_GUILD_ID` becomes a **migration seed**: on first boot we
create a single `DiscordServers` row marked `isPrimary` from that env var so nothing
breaks. After that, the collection is the source of truth and the env var can
retire.

## Sub-project B - Clone tool

**Where it lives:** A new view/flow in the existing Server Manager admin panel,
reusing the `/api/discord/server/*` infrastructure and the bot client that already
reads guild structure.

**Flow:**

1. **Pick target.** Admin pastes the target guild ID (a server the bot has already
   been invited to - see Bot-join flow). The tool verifies the bot is present and
   holds Manage Roles / Manage Channels / Manage Server permissions there.
2. **Read source.** Reads the primary server's roles, category/channel tree (with
   overwrites), emojis/stickers, and settings - mostly extending the existing
   `/structure` route.
3. **Select.** Shows a checkbox tree: roles on one side, categories (each expandable
   to its channels) on the other, plus toggles for emojis/stickers and server
   settings. Everything checked by default. Unchecking a category cascades to skip
   its channels. Example: unchecking the NA team "Dragon" category skips its
   channels, and Dragon's roles can be unchecked too.
4. **Stamp** (the careful part), in dependency order:
   - **Roles first.** Create each selected role (name, color, permission flags,
     hoist, mentionable). Record an `oldRoleId -> newRoleId` map. Recreate top-down
     so hierarchy order matches. `@everyone` and the bot's own managed role are
     handled specially, not duplicated.
   - **Categories, then channels.** Create each selected category, then its channels
     (name, type, topic, position). For each channel's permission overwrites, look
     up the new role in the map. **If the role was not copied, drop that overwrite.**
   - **Emojis/stickers and server settings** if checked.
5. **Report.** Summary of what was created, what was skipped, and any failures (e.g.
   an emoji limit hit). The tool keeps going rather than aborting on a single
   failure, since the result is tidied by hand anyway.

**Explicitly NOT copied:** members, messages, invites, webhooks, third-party
integrations, role assignments to people.

**Risks handled:**

- **Rate limits.** `discord.js` queues requests; a large server means the stamp
  takes some time, so the tool shows progress.
- **Managed/bot roles** cannot be recreated; they are skipped with a note.
- **Hierarchy ordering.** Roles are created before channel overwrites reference
  them, which is why roles are stamped first.

## Sub-project A - Multi-server registry + routing

The mechanical heart of A is a single helper, `resolveGuildId(serverId?)`, that:

- Returns the requested server's guild ID if one is passed,
- Falls back to the `isPrimary` server otherwise,
- Reads from the `DiscordServers` collection (env var only as the migration seed).

Then a mechanical sweep: every `/api/discord/server/*` route takes an optional
`serverId` param and passes it through; the Server Manager UI gains a **server
picker** at the top that scopes every action to the selected server.

PUG, voice, and feed services stay pointed at the primary server (piece 3 is out of
scope). They call the helper with no argument, get the primary, and their behavior
is unchanged.

The single bot client needs **no change** - it is already a member of every server
it is invited to. We are only changing which guild ID each operation targets.

## Bot-join flow

Standard Discord OAuth: from the Server Manager, an "Add a server" action generates
the bot invite URL with the right permission scopes baked in. The admin opens it,
picks the new server, and authorizes. The bot joins; the admin grabs the guild ID
(or we detect newly-joined guilds and list them). From there the server is a clone
target (B) and/or a registry entry (A).

No per-server tokens or extra bot accounts: one bot, many guilds.
