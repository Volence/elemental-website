/**
 * Read-only smoke check for the access review report.
 *
 * Runs the SAME queries the GET /api/access-review route runs, feeds them to buildReport,
 * and prints a summary. Verifies the query shapes and the flag computation against real
 * data without needing a browser session. Writes nothing.
 *
 * Run: docker compose exec -T payload npx payload run scripts/access-review-smoke.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildReport } from '../src/accessReview/compute'

const payload = await getPayload({ config })

const [people, teams, sessions, audits] = await Promise.all([
  payload.find({ collection: 'people', limit: 0, depth: 1, overrideAccess: true }),
  payload.find({ collection: 'teams', limit: 0, depth: 0, overrideAccess: true }),
  payload.find({
    collection: 'active-sessions',
    limit: 5000,
    sort: '-loginTime',
    depth: 0,
    overrideAccess: true,
  }),
  payload.find({
    collection: 'audit-logs',
    where: { collection: { equals: 'people' }, action: { equals: 'update' } },
    limit: 3000,
    sort: '-createdAt',
    depth: 1,
    overrideAccess: true,
  }),
])

console.log('[smoke] raw counts', {
  people: people.totalDocs,
  teams: teams.totalDocs,
  sessions: sessions.totalDocs,
  peopleUpdateAudits: audits.totalDocs,
})

// discordMemberIds null on purpose: this script does not boot the bot, and null is the
// "check could not run" path that must never flag anyone as having left.
const report = buildReport({
  people: people.docs as never,
  teams: teams.docs as never,
  sessions: sessions.docs as never,
  accessAudits: audits.docs as never,
  discordMemberIds: null,
  guildId: null,
  now: Date.now(),
})

const counts = { 'team-without-roster': 0, 'not-in-discord': 0, dormant: 0, 'no-review-record': 0 }
for (const person of report.people) {
  for (const flag of person.flags) counts[flag] += 1
}

console.log('[smoke] in scope:', report.people.length, 'of', people.totalDocs)
console.log('[smoke] discord available:', report.discord.available)
console.log('[smoke] flag counts:', counts)

const withTeams = report.people.filter((p) => p.teams.length)
console.log('[smoke] people with team access:', withTeams.length)

const stale = report.people.filter((p) => p.flags.includes('team-without-roster'))
console.log('[smoke] sample team-access-without-roster (up to 10):')
for (const person of stale.slice(0, 10)) {
  const bad = person.teams.filter((t) => t.standing === null).map((t) => t.teamName)
  console.log(`  - ${person.name} (${person.role ?? 'no role'}) -> ${bad.join(', ')}`)
}

console.log('[smoke] sample rostered access (up to 5), standing must be non-null:')
for (const person of withTeams.filter((p) => p.teams.some((t) => t.standing)).slice(0, 5)) {
  console.log(`  - ${person.name}: ${person.teams.map((t) => `${t.teamName}=${t.standing}`).join(', ')}`)
}

const reviewed = report.people.filter((p) => p.lastAccessChange)
console.log('[smoke] people with an access-change record:', reviewed.length)
console.log('[smoke] anyone wrongly flagged not-in-discord:', counts['not-in-discord'])

process.exit(0)
