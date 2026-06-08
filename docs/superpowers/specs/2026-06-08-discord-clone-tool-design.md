# Discord Clone Tool (Sub-project B) - Design

**Date:** 2026-06-08
**Status:** Implemented on branch `feature/discord-clone-tool` (2026-06-08) - code-complete and statically verified (typechecks, pure planning logic unit-tested, full multi-stage review). PENDING live end-to-end verification against a real Discord guild before merge.
**Parent:** [Multi-Server Discord Architecture](./2026-06-08-multi-server-discord-architecture-design.md)

## Purpose

A one-shot, selective tool that copies the "bones" of the primary Discord server
(roles, permissions, channel structure, emojis/stickers, server settings) into a
new target server. This makes standing up a new region server cheap: clone the
bones, then tidy by hand. It is the first sub-project of the multi-server effort and
ships before the full multi-server registry, because it only needs the primary
server plus a target guild ID typed in by the admin.

The clone is a one-shot stamp, not an ongoing sync. Once a target is stamped it
diverges freely and is maintained by hand.

## Design

### 1. Source

Always the **primary** server (the `isPrimary` hub - until the `DiscordServers`
registry exists, this is the server identified by `DISCORD_GUILD_ID`). No
"clone from an arbitrary server" picker in v1; the hub is the canonical bones.

### 2. Target

The admin pastes the target guild ID. The tool verifies the bot is a member of that
guild and holds Manage Roles, Manage Channels, and Manage Server permissions there.
If not, it refuses with a clear message. (Getting the bot into the target server is
the standard OAuth bot-invite flow described in the parent doc's Bot-join section.)

### 3. Selection

Selection is fresh each run (ephemeral - not saved as reusable profiles in v1). The
UI shows a checkbox tree:

- Roles on one side.
- Categories on the other, each expandable to its channels. Unchecking a category
  cascades to skip all of its channels.
- Toggles for emojis/stickers and for server settings.

Everything is checked by default. Example: unchecking the NA team "Dragon" category
skips its channels, and Dragon's roles can be unchecked separately.

Note for later: the existing `DiscordCategoryTemplates` collection could back saved
clone profiles if that is ever wanted. Out of scope for v1.

### 4. Execution - background job

Clicking "Clone" creates a job record and returns immediately. A worker runs the
stamp. The UI polls for progress (e.g. `roles 8/8, channels 12/40...`). The job
survives a tab close, and its final state holds the full report.

### 5. Stamp order and idempotency

Idempotency strategy is **skip-by-name** throughout: before creating an item, check
whether one with the same name already exists in the target; if so, skip creation
and reuse the existing item. This makes re-runs safe and lets a partially failed job
be recovered by simply running it again.

Stamp order (dependency order):

1. **Roles first**, created top-down so hierarchy order matches the source.
   - Skip any role whose name already exists in the target; reuse it in the
     `oldRoleId -> newRoleId` map.
   - Skip `@everyone` and managed/bot roles (they cannot be recreated).
   - Copy name, color, permission flags, hoist, mentionable.
2. **Categories, then channels.**
   - Skip by name if already present in the target.
   - Copy name, type, topic, position.
   - For each channel's permission overwrites, map the source role to the
     new/existing role via the role map. **Drop any overwrite whose role was not
     copied.**
3. **Emojis/stickers and server settings** last, if their toggles are checked.
   - Skip emojis/stickers already present by name.
   - Server settings: verification level, default notification setting, system/rules
     channel config, content filter.

### 6. Resilience

A single failure (e.g. an emoji limit hit, an unsupported channel type) is logged
and the job continues rather than aborting. The final report lists each item as
created / skipped / failed, so the admin knows exactly what to tidy by hand.

### 7. Where it lives and new pieces

Lives as a new tab in the existing Server Manager admin view, reusing the bot client
and extending the existing `/api/discord/server/structure` read route for the source
read.

New pieces to build:

- A **`DiscordCloneJobs`** collection (or equivalent) holding job state, progress
  counters, and the final report.
- A **start-clone** route that validates the target and creates the job.
- A **poll-job** route the UI uses for progress and the final report.
- The **clone worker** that performs the stamp in the order above.
- The **selection-tree UI** in the Server Manager.

## Out of scope (unchanged from parent)

Members, messages, invites, webhooks, third-party integrations, and role
assignments to people are never copied. The clone is one-shot, not an ongoing sync.
