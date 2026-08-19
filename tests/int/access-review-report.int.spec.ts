import { describe, it, expect } from 'vitest'
import { buildReport } from '@/accessReview/compute'
import type { BuildReportInput } from '@/accessReview/types'

const NOW = Date.parse('2026-08-18T00:00:00.000Z')
const RECENT = '2026-08-10T00:00:00.000Z'
const ANCIENT = '2025-01-01T00:00:00.000Z'

const base = (over: Partial<BuildReportInput> = {}): BuildReportInput => ({
  people: [],
  teams: [],
  sessions: [],
  accessAudits: [],
  discordMemberIds: new Set<string>(),
  guildId: 'guild-1',
  now: NOW,
  ...over,
})

const healthy = {
  id: 1,
  name: 'Rostered Coach',
  role: 'player',
  discordId: '111',
  assignedTeams: [{ id: 10, name: 'Hydrus' }],
}

const healthyInput = (over: Partial<BuildReportInput> = {}): BuildReportInput =>
  base({
    people: [healthy],
    teams: [{ id: 10, name: 'Hydrus', coaches: [{ person: { id: 1 } }] }],
    sessions: [{ user: 1, loginTime: RECENT, lastActivity: RECENT }],
    accessAudits: [
      { documentId: '1', createdAt: RECENT, user: { name: 'Volence' }, metadata: { accessFields: ['role'] } },
    ],
    discordMemberIds: new Set(['111']),
    ...over,
  })

describe('buildReport scope', () => {
  it('excludes people with no elevated access', () => {
    const report = buildReport(base({ people: [{ id: 2, name: 'Nobody', role: 'user' }] }))
    expect(report.people).toEqual([])
  })

  it('includes a person with only team access and reports their standing', () => {
    const report = buildReport(healthyInput())
    expect(report.people).toHaveLength(1)
    expect(report.people[0].teams).toEqual([{ teamId: 10, teamName: 'Hydrus', standing: 'coach' }])
  })

  it('sorts people by name', () => {
    const report = buildReport(
      base({ people: [{ id: 1, name: 'Zed', role: 'admin' }, { id: 2, name: 'Ana', role: 'admin' }] }),
    )
    expect(report.people.map((p) => p.name)).toEqual(['Ana', 'Zed'])
  })
})

describe('buildReport flags', () => {
  it('flags nothing for a rostered, recent, reviewed, present person', () => {
    expect(buildReport(healthyInput()).people[0].flags).toEqual([])
  })

  it('flags team access without a roster spot', () => {
    const report = buildReport(healthyInput({ teams: [{ id: 10, name: 'Hydrus' }] }))
    expect(report.people[0].flags).toContain('team-without-roster')
    expect(report.people[0].teams[0].standing).toBe(null)
  })

  it('flags someone who is not in the guild', () => {
    const report = buildReport(healthyInput({ discordMemberIds: new Set(['999']) }))
    expect(report.people[0].inDiscord).toBe(false)
    expect(report.people[0].flags).toContain('not-in-discord')
  })

  it('never flags not-in-discord when the check could not run', () => {
    const report = buildReport(healthyInput({ discordMemberIds: null }))
    expect(report.people[0].inDiscord).toBe(null)
    expect(report.people[0].flags).not.toContain('not-in-discord')
    expect(report.discord.available).toBe(false)
  })

  it('leaves inDiscord unknown when the person has no discordId', () => {
    const report = buildReport(
      healthyInput({ people: [{ ...healthy, discordId: null }] }),
    )
    expect(report.people[0].inDiscord).toBe(null)
    expect(report.people[0].flags).not.toContain('not-in-discord')
  })

  it('flags dormant past the threshold and not before it', () => {
    expect(buildReport(healthyInput({ sessions: [{ user: 1, loginTime: ANCIENT }] })).people[0].flags)
      .toContain('dormant')
    expect(buildReport(healthyInput()).people[0].flags).not.toContain('dormant')
  })

  it('flags a person who has never logged in as dormant', () => {
    expect(buildReport(healthyInput({ sessions: [] })).people[0].flags).toContain('dormant')
  })

  it('flags no-review-record when there is no access audit entry', () => {
    const report = buildReport(healthyInput({ accessAudits: [] }))
    expect(report.people[0].lastAccessChange).toBe(null)
    expect(report.people[0].flags).toContain('no-review-record')
  })

  it('flags no-review-record when the last change is older than the review window', () => {
    const report = buildReport(
      healthyInput({
        accessAudits: [{ documentId: '1', createdAt: ANCIENT, metadata: { accessFields: ['role'] } }],
      }),
    )
    expect(report.people[0].flags).toContain('no-review-record')
  })

  it('honours custom thresholds', () => {
    const report = buildReport(healthyInput({ dormantDays: 1, reviewDays: 1 }))
    expect(report.people[0].flags).toEqual(['dormant', 'no-review-record'])
  })
})

describe('buildReport metadata', () => {
  it('reports generation time and guild availability', () => {
    const report = buildReport(healthyInput())
    expect(report.generatedAt).toBe('2026-08-18T00:00:00.000Z')
    expect(report.discord).toEqual({ available: true, guildId: 'guild-1' })
  })

  it('lists only the department flags that are true', () => {
    const report = buildReport(
      base({
        people: [
          { id: 1, name: 'Staffer', role: 'user', departments: { isPugAdmin: true, isEventsStaff: false } },
        ],
      }),
    )
    expect(report.people[0].departments).toEqual(['isPugAdmin'])
  })
})
