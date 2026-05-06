# Production & Social Media Discord Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pronouns/pronunciation fields to People, create a `/production` Discord command for casting prep, and create a `/matches-post` command that formats today's matches for social media copy-paste.

**Architecture:** Two new fields on the People collection (Profile tab), two new top-level Discord slash commands. `/production` fetches a team with populated roster and displays casting-relevant info. `/matches-post` reuses the match-day query window from `matches-today.ts` and formats output as plain text with team emojis for social media copy-paste.

**Tech Stack:** Payload CMS collections (TypeScript), Discord.js slash commands, EmbedBuilder

---

### Task 1: Add pronouns and pronunciation fields to People collection

**Files:**
- Modify: `src/collections/People/index.ts:115-189` (Profile tab fields)

- [ ] **Step 1: Add pronouns field after the name field**

In `src/collections/People/index.ts`, inside the Profile tab's `fields` array, add the `pronouns` field directly after the `name` field (after line 126):

```typescript
{
  name: 'pronouns',
  type: 'text',
  access: {
    update: ownerOrManager,
  },
  admin: {
    description: 'Pronouns (e.g., he/him, she/her, they/them)',
    placeholder: 'e.g., he/him',
  },
},
```

- [ ] **Step 2: Add pronunciation field after pronouns**

Directly after the new `pronouns` field, add:

```typescript
{
  name: 'pronunciation',
  type: 'text',
  access: {
    update: ownerOrManager,
  },
  admin: {
    description: 'Name pronunciation guide for casters and production',
    placeholder: 'e.g., "VOL-ens" or "rhymes with fence"',
  },
},
```

- [ ] **Step 3: Verify the dev server starts without errors**

Run: `docker compose up` (or check running container logs)
Expected: No schema errors. The People collection in the admin panel should show Pronouns and Pronunciation fields on the Profile tab, directly below the Name field.

- [ ] **Step 4: Commit**

```bash
git add src/collections/People/index.ts
git commit -m "feat: add pronouns and pronunciation fields to People collection"
```

---

### Task 2: Create the `/production` slash command handler

**Files:**
- Create: `src/discord/commands/production.ts`

- [ ] **Step 1: Create the production command handler**

Create `src/discord/commands/production.ts`:

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleProduction(interaction: ChatInputCommandInteraction): Promise<void> {
  const teamSlug = interaction.options.getString('team-name', true)

  try {
    await interaction.deferReply()

    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'teams',
      where: { slug: { equals: teamSlug } },
      limit: 1,
      depth: 2,
    })

    if (!result.docs.length) {
      await interaction.editReply({ content: `Team not found: \`${teamSlug}\`` })
      return
    }

    const team = result.docs[0] as any

    const embed = new EmbedBuilder()
      .setTitle(`${team.discordEmoji || ''} ${team.name} - Production Sheet`.trim())
      .setColor(team.brandingPrimary ? parseInt(team.brandingPrimary.replace('#', ''), 16) : 0x00d4aa)

    // Roster with pronouns and pronunciation
    const rosterLines: string[] = []
    if (team.roster?.length) {
      for (const player of team.roster) {
        const person = player.person
        if (!person || typeof person !== 'object') continue

        const name = person.name || 'Unknown'
        const role = player.role === 'tank' ? 'Tank' : player.role === 'dps' ? 'DPS' : player.role === 'support' ? 'Support' : player.role || ''
        const parts: string[] = [`**${name}** - ${role}`]

        if (person.pronouns) {
          parts.push(`Pronouns: ${person.pronouns}`)
        }
        if (person.pronunciation) {
          parts.push(`Say: "${person.pronunciation}"`)
        }

        rosterLines.push(parts.join('\n'))
      }
    }

    if (rosterLines.length) {
      embed.addFields({
        name: 'Roster',
        value: rosterLines.join('\n\n'),
        inline: false,
      })
    } else {
      embed.addFields({
        name: 'Roster',
        value: 'No roster found',
        inline: false,
      })
    }

    // Subs
    if (team.subs?.length) {
      const subLines: string[] = []
      for (const sub of team.subs) {
        const person = sub.person
        if (!person || typeof person !== 'object') continue
        const name = person.name || 'Unknown'
        const parts: string[] = [name]
        if (person.pronouns) parts.push(`(${person.pronouns})`)
        if (person.pronunciation) parts.push(`- "${person.pronunciation}"`)
        subLines.push(parts.join(' '))
      }
      if (subLines.length) {
        embed.addFields({
          name: 'Subs',
          value: subLines.join('\n'),
          inline: false,
        })
      }
    }

    // FaceIt stats
    if (team.faceitEnabled) {
      try {
        const seasons = await payload.find({
          collection: 'faceit-seasons',
          where: {
            team: { equals: team.id },
            isActive: { equals: true },
          },
          limit: 1,
        })

        if (seasons.docs.length) {
          const season = seasons.docs[0] as any
          const standings = season.standings || {}
          const wins = standings.wins || 0
          const losses = standings.losses || 0
          const rank = standings.currentRank
          const total = standings.totalTeams

          const lines: string[] = []
          lines.push(`**${season.division || 'Unranked'}** ${season.region || ''}`)
          lines.push(`Record: **${wins}-${losses}**`)
          if (rank && total) lines.push(`Rank: **#${rank}** of ${total}`)

          embed.addFields({
            name: 'FaceIt',
            value: lines.join('\n'),
            inline: false,
          })
        }
      } catch (error) {
        // Don't fail the whole command if FaceIt fetch fails
      }
    }

    // Staff
    const staffLines: string[] = []
    if (team.manager?.length) {
      const names = team.manager
        .map((m: any) => m.person && typeof m.person === 'object' ? m.person.name : null)
        .filter(Boolean)
      if (names.length) staffLines.push(`**Manager:** ${names.join(', ')}`)
    }
    if (team.coaches?.length) {
      const names = team.coaches
        .map((c: any) => c.person && typeof c.person === 'object' ? c.person.name : null)
        .filter(Boolean)
      if (names.length) staffLines.push(`**Coach:** ${names.join(', ')}`)
    }
    if (team.captain?.length) {
      const names = team.captain
        .map((c: any) => c.person && typeof c.person === 'object' ? c.person.name : null)
        .filter(Boolean)
      if (names.length) staffLines.push(`**Captain:** ${names.join(', ')}`)
    }
    if (staffLines.length) {
      embed.addFields({
        name: 'Staff',
        value: staffLines.join('\n'),
        inline: false,
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('Error handling production command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while fetching production info.' })
    } else {
      await interaction.reply({ content: 'An error occurred while fetching production info.', ephemeral: true })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/commands/production.ts
git commit -m "feat: add /production command handler for casting prep"
```

---

### Task 3: Create the `/matches-post` slash command handler

**Files:**
- Create: `src/discord/commands/matches-post.ts`

- [ ] **Step 1: Create the matches-post command handler**

Create `src/discord/commands/matches-post.ts`. This command formats today's matches as plain text for social media copy-paste, grouped by division, with team emojis.

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handleMatchesPost(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply()

    const payload = await getPayload({ config: configPromise })

    // Same match-day window as matches-today: 08:00 UTC -> 08:00 UTC next day
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(8, 0, 0, 0)
    if (now.getUTCHours() < 8) {
      startOfDay.setUTCDate(startOfDay.getUTCDate() - 1)
    }
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    const matches = await payload.find({
      collection: 'matches',
      where: {
        and: [
          { date: { greater_than_equal: startOfDay.toISOString() } },
          { date: { less_than_equal: endOfDay.toISOString() } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      limit: 50,
      sort: 'date',
      depth: 2,
    })

    if (!matches.docs.length) {
      await interaction.editReply({ content: 'No matches scheduled for today.' })
      return
    }

    // Build a map of team ID -> emoji for quick lookup
    const teamEmojiMap = new Map<number, string>()
    const allTeams = await payload.find({
      collection: 'teams',
      limit: 100,
      depth: 0,
    })
    for (const t of allTeams.docs) {
      if (t.discordEmoji) {
        teamEmojiMap.set(t.id, t.discordEmoji)
      }
    }

    // Group by division
    const matchesByDivision: Record<string, any[]> = {}
    for (const match of matches.docs) {
      const division = (match as any).league || 'Other'
      if (!matchesByDivision[division]) matchesByDivision[division] = []
      matchesByDivision[division].push(match)
    }

    const divisionOrder = ['Masters', 'Expert', 'Advanced', 'Open', 'Other']
    const sortedDivisions = Object.keys(matchesByDivision).sort(
      (a, b) => divisionOrder.indexOf(a) - divisionOrder.indexOf(b),
    )

    const sections: string[] = []

    for (const division of sortedDivisions) {
      const divMatches = matchesByDivision[division]
      const lines: string[] = []

      for (const match of divMatches) {
        // Resolve team 1 name and emoji
        let team1Name = 'TBD'
        let team1Emoji = ''
        if (match.team1Type === 'internal' && match.team1Internal) {
          const t1 = match.team1Internal
          if (typeof t1 === 'object') {
            team1Name = t1.name || 'ELMT'
            team1Emoji = t1.discordEmoji || teamEmojiMap.get(t1.id) || ''
          }
        } else if (match.team1Type === 'external' && match.team1External) {
          team1Name = match.team1External
        } else if (match.team && typeof match.team === 'object') {
          team1Name = match.team.name || 'ELMT'
          team1Emoji = match.team.discordEmoji || teamEmojiMap.get(match.team.id) || ''
        }

        // Resolve team 2 / opponent name
        let team2Name = (match as any).opponent || 'TBD'
        if (match.team2Type === 'internal' && match.team2Internal) {
          const t2 = match.team2Internal
          if (typeof t2 === 'object') {
            team2Name = t2.name || 'ELMT'
          }
        } else if (match.team2Type === 'external' && match.team2External) {
          team2Name = match.team2External
        }

        lines.push(`${team1Emoji}${team1Name} vs ${team2Name}`)
      }

      sections.push(`**${division}**\n${lines.join('\n')}`)
    }

    const header = `ELMT NA GAME DAY!\n\n`
    const body = sections.join('\n\n')

    // Send as plain text (not embed) so SM can easily copy it
    await interaction.editReply({ content: header + body })
  } catch (error) {
    console.error('Error handling matches-post command:', error)
    if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while generating the matches post.' })
    } else {
      await interaction.reply({ content: 'An error occurred while generating the matches post.', ephemeral: true })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/commands/matches-post.ts
git commit -m "feat: add /matches-post command for social media match formatting"
```

---

### Task 4: Register both new slash commands

**Files:**
- Modify: `src/discord/commands/register.ts:6-203`

- [ ] **Step 1: Add both command definitions to buildCommands()**

In `src/discord/commands/register.ts`, add these two new commands inside the array returned by `buildCommands()`, before the `.map((command) => command.toJSON())` call at line 203.

Add after the `matches` command definition (after line 134) and before the `availability` command:

```typescript
    // Production info command (casting prep)
    new SlashCommandBuilder()
      .setName('production')
      .setDescription('Get production/casting info for a team (roster, pronouns, pronunciation)')
      .addStringOption((option) =>
        option
          .setName('team-name')
          .setDescription('Name of the team')
          .setRequired(true)
          .setAutocomplete(true),
      ),

    // Matches post formatter for social media
    new SlashCommandBuilder()
      .setName('matches-post')
      .setDescription('Format today\'s matches for social media (copy-paste ready)'),
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/commands/register.ts
git commit -m "feat: register /production and /matches-post slash commands"
```

---

### Task 5: Wire up both commands in the interaction handler

**Files:**
- Modify: `src/discord/handlers/interactions.ts:1-126`

- [ ] **Step 1: Add imports for both new handlers**

At the top of `src/discord/handlers/interactions.ts`, add these imports after the existing command imports (after line 10, the `handleMatchesToday` import):

```typescript
import { handleProduction } from '../commands/production'
import { handleMatchesPost } from '../commands/matches-post'
```

- [ ] **Step 2: Add command routing in handleChatCommand**

In the `handleChatCommand` function, add these two new `else if` blocks. Add after the `matches` handler (after line 101) and before the `availability` handler:

```typescript
  } else if (commandName === 'production') {
    await handleProduction(interaction)
  } else if (commandName === 'matches-post') {
    await handleMatchesPost(interaction)
```

- [ ] **Step 3: Add autocomplete support for the /production command**

In the `handleAutocomplete` function (around line 128), add `production` to the autocomplete routing. Change:

```typescript
  if (commandName === 'team') {
    await handleTeamAutocomplete(interaction)
  }
```

To:

```typescript
  if (commandName === 'team' || commandName === 'production') {
    await handleTeamAutocomplete(interaction)
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/discord/handlers/interactions.ts
git commit -m "feat: wire up /production and /matches-post in interaction handler"
```

---

### Task 6: Verify autocomplete works for the /production command

**Files:**
- Read: `src/discord/utils/autocomplete.ts`

- [ ] **Step 1: Check that the autocomplete handler works for non-subcommand usage**

Read `src/discord/utils/autocomplete.ts` and verify the `handleTeamAutocomplete` function extracts the focused option correctly. The `/team` command uses subcommands so the option is nested, but `/production` is a top-level command with a direct `team-name` option. Check that the autocomplete handler reads `team-name` in a way that works for both patterns.

If the autocomplete handler uses `interaction.options.getFocused()` it will work for both. If it specifically looks for a subcommand option path, it may need adjustment. Inspect and fix if needed.

- [ ] **Step 2: Commit if changes were needed**

```bash
git add src/discord/utils/autocomplete.ts
git commit -m "fix: ensure autocomplete works for top-level team-name option"
```

---

### Task 7: Test both commands end-to-end

- [ ] **Step 1: Ensure the dev server is running**

The dev server should be running via `docker compose up`. Check logs for any TypeScript compilation errors related to the new files.

- [ ] **Step 2: Re-register slash commands**

The commands need to be registered with Discord. Check how other commands trigger registration - it likely happens on bot startup or via an API endpoint. Trigger a re-registration so Discord knows about `/production` and `/matches-post`.

- [ ] **Step 3: Test /production command**

In Discord, run `/production team-name:ground` (or any team slug). Verify:
- Autocomplete works and shows team options
- Embed displays with team name and emoji
- Roster shows player names with roles
- If any player has pronouns/pronunciation set, they appear
- FaceIt stats appear if the team has FaceIt enabled
- Staff section shows managers/coaches/captains

- [ ] **Step 4: Test /matches-post command**

In Discord, run `/matches-post`. Verify:
- Shows today's matches grouped by division
- Each line shows: `[emoji]TeamName vs OpponentName`
- Format is plain text (not embed) for easy copy-paste
- Output matches the social media format the team uses

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```
