import { describe, it, expect } from 'vitest'
import {
  buildSchedulePosts,
  formatStaffSchedule,
  formatPublicSchedule,
  splitAtBoundaries,
  schedulePostRelevantChange,
  type ScheduleMatch,
} from '@/utilities/productionSchedulePost'

const observer = { id: 1, name: 'Obs One', discordId: '111111111111111111' }
const producer = { id: 2, name: 'Prod Two', discordId: null }
const caster = { id: 3, name: 'Cast Three', discordId: '333333333333333333' }

function match(overrides: Partial<ScheduleMatch> = {}): ScheduleMatch {
  return {
    id: 10,
    title: 'Dragon vs Rivals',
    date: '2026-09-08T00:00:00.000Z',
    opponent: 'Rivals',
    league: 'Faceit Season 10',
    region: 'NA',
    faceitLobby: 'https://www.faceit.com/en/ow2/room/abc',
    team1Type: 'internal',
    team1Internal: { name: 'Dragon', region: 'NA', rating: 'FACEIT Advanced' },
    productionWorkflow: {
      includeInSchedule: true,
      coverageStatus: 'full',
      assignedObserver: observer,
      assignedProducer: producer,
      assignedCasters: [{ user: caster }],
    },
    ...overrides,
  }
}

describe('formatStaffSchedule', () => {
  it('renders the staff post with Discord timestamps and real mentions', () => {
    const text = formatStaffSchedule([match()], { mentionStyle: 'discord' })
    expect(text).toContain('Schedule for the week!')
    expect(text).toContain('<t:1788825600:F>:')
    expect(text).toContain('ELMT Dragon vs Rivals')
    expect(text).toContain('FACEIT Lobby: https://www.faceit.com/en/ow2/room/abc')
    expect(text).toContain('Observer: <@111111111111111111>')
    // No Discord ID linked: fall back to the name so the post still reads
    expect(text).toContain('Producer: @Prod Two')
    expect(text).toContain('Casters: <@333333333333333333>')
  })

  it('uses plain @names in preview mode', () => {
    const text = formatStaffSchedule([match()], { mentionStyle: 'preview' })
    expect(text).toContain('Observer: @Obs One')
    expect(text).not.toContain('<@')
  })

  it('falls back to TBD for missing lobby and staff', () => {
    const text = formatStaffSchedule(
      [match({ faceitLobby: null, productionWorkflow: { includeInSchedule: true, coverageStatus: 'partial' } })],
      { mentionStyle: 'discord' },
    )
    expect(text).toContain('FACEIT Lobby: https://www.faceit.com/en/ow2/room/[TBD]')
    expect(text).toContain('Observer: TBD')
    expect(text).toContain('Producer: TBD')
    expect(text).toContain('Casters: TBD')
  })

  it('does not double the ELMT prefix', () => {
    const text = formatStaffSchedule([match({ team1Internal: { name: 'ELMT Dragon' } })], { mentionStyle: 'discord' })
    expect(text).toContain('ELMT Dragon vs Rivals')
    expect(text).not.toContain('ELMT ELMT')
  })

  it('says so when nothing is selected', () => {
    expect(formatStaffSchedule([], { mentionStyle: 'discord' })).toContain('No matches selected')
  })
})

describe('formatPublicSchedule', () => {
  it('renders region, division and league from the team', () => {
    const text = formatPublicSchedule([match()])
    expect(text).toContain("This Week's ELMT Broadcast Schedule")
    expect(text).toContain('## 🎮 **ELMT Dragon vs Rivals**')
    expect(text).toContain('🌐 NA / Advanced • Faceit Season 10')
    expect(text).toContain('🕐 <t:1788825600:F>')
    expect(text).toContain('🎬 Stream: https://twitch.tv/elmt_gg')
    expect(text).toContain('👁️ Observer: Obs One')
    expect(text).toContain('🎙️ Casters: Cast Three')
  })

  it('never puts a Discord mention in the public post', () => {
    expect(formatPublicSchedule([match()])).not.toContain('<@')
  })

  it('replaces a tier name in the league field with the default league', () => {
    const text = formatPublicSchedule([match({ league: 'Advanced' })], { defaultLeague: 'Faceit Season 10' })
    expect(text).toContain('• Faceit Season 10')
  })

  it('reads numeric ratings as Open', () => {
    const text = formatPublicSchedule([match({ team1Internal: { name: 'Water', region: 'NA', rating: '3.5K' } })])
    expect(text).toContain('NA / Open')
  })
})

describe('splitAtBoundaries', () => {
  it('keeps everything in one message when it fits', () => {
    const out = splitAtBoundaries('Header\n\n', ['a', 'b', 'c'], '\n---\n', 2000)
    expect(out).toEqual(['Header\n\na\n---\nb\n---\nc'])
  })

  it('splits only between sections and keeps every message under the limit', () => {
    const section = 'x'.repeat(700)
    const out = splitAtBoundaries('H\n', [section, section, section, section], '\n', 2000)
    expect(out.length).toBe(2)
    for (const msg of out) expect(msg.length).toBeLessThanOrEqual(2000)
    expect(out[0].startsWith('H\n')).toBe(true)
    expect(out[1].startsWith('H\n')).toBe(false)
    // Sections are never cut in half
    for (const msg of out) expect(msg.split('x'.repeat(700)).length - 1).toBeGreaterThan(0)
  })
})

describe('schedulePostRelevantChange', () => {
  const base = match()
  it('ignores matches that are not and were not in the schedule', () => {
    const off = match({ productionWorkflow: { includeInSchedule: false, coverageStatus: 'full' } })
    expect(schedulePostRelevantChange(off, off)).toBe(false)
    expect(schedulePostRelevantChange(off, undefined)).toBe(false)
  })
  it('fires when a match is added to or removed from the schedule', () => {
    const off = match({ productionWorkflow: { includeInSchedule: false, coverageStatus: 'full' } })
    expect(schedulePostRelevantChange(base, off)).toBe(true)
    expect(schedulePostRelevantChange(off, base)).toBe(true)
  })
  it('fires for a date, lobby, opponent, status or assignment change on a scheduled match', () => {
    expect(schedulePostRelevantChange(match({ date: '2026-09-09T00:00:00.000Z' }), base)).toBe(true)
    expect(schedulePostRelevantChange(match({ faceitLobby: 'https://x' }), base)).toBe(true)
    expect(schedulePostRelevantChange(match({ opponent: 'Other' }), base)).toBe(true)
    expect(schedulePostRelevantChange(match({ status: 'cancelled' } as any), base)).toBe(true)
    const reassigned = match({
      productionWorkflow: { ...base.productionWorkflow!, assignedProducer: { id: 9, name: 'New Prod' } },
    })
    expect(schedulePostRelevantChange(reassigned, base)).toBe(true)
  })
  it('stays quiet for unrelated edits on a scheduled match', () => {
    expect(schedulePostRelevantChange(match({ title: 'Renamed' }), base)).toBe(false)
    const sameIds = match({
      productionWorkflow: { ...base.productionWorkflow!, assignedProducer: 2 },
    })
    // Populated object vs bare id for the same person is not a change
    expect(schedulePostRelevantChange(sameIds, base)).toBe(false)
  })
})

describe('buildSchedulePosts', () => {
  it('returns chunked staff and public messages for the selected matches only', () => {
    const selected = match()
    const notSelected = match({ id: 11, productionWorkflow: { includeInSchedule: false, coverageStatus: 'full' } })
    const posts = buildSchedulePosts([selected, notSelected], { mentionStyle: 'discord' })
    expect(posts.staff.length).toBe(1)
    expect(posts.public.length).toBe(1)
    expect(posts.staff[0]).toContain('Dragon vs Rivals')
    expect(posts.matchIds).toEqual([10])
  })

  it('splits a long week across several messages', () => {
    const many = Array.from({ length: 12 }, (_, i) => match({ id: 100 + i, opponent: `Opponent ${i}` }))
    const posts = buildSchedulePosts(many, { mentionStyle: 'discord' })
    expect(posts.public.length).toBeGreaterThan(1)
    for (const msg of [...posts.staff, ...posts.public]) expect(msg.length).toBeLessThanOrEqual(2000)
  })
})
