import { describe, it, expect } from 'vitest'
import { suggestLineup } from '../../src/components/scheduling/AutoLineup'
import {
  computeTrialRoles,
  withTrialSlots,
  scheduleHasContent,
  setSlotPlayers,
} from '../../src/components/scheduling/lineup-roles'
import { mergeAvailabilityResponse } from '../../src/lib/availability/merge-response'
import { formatScheduleChunks, packDiscordMessages, DISCORD_MESSAGE_LIMIT } from '../../src/discord/handlers/schedule-format'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPECIFIC_ROLES = ['Tank', 'Hitscan', 'Flex DPS', 'Main Support', 'Flex Support']

function person(id: number, name: string) {
  return { id, name, discordId: `d${id}` }
}

function block(slots: { role: string; isTrial?: boolean; playerIds?: string[]; isRinger?: boolean; ringerName?: string }[], time = '8-10', startTime = '20:00') {
  return {
    id: `b-${time}`,
    time,
    startTime,
    slots: slots.map(s => ({ role: s.role, playerId: s.playerIds?.[0] || null, playerIds: s.playerIds || [], isTrial: s.isTrial, isRinger: s.isRinger, ringerName: s.ringerName })),
  }
}

function day(blocks: any[], isoDate = '2026-09-02') {
  return { date: 'Wednesday Sep 2', isoDate, enabled: true, blocks }
}

function response(discordId: string, opts: { scheduleRole?: string; scheduleStatus?: string; status?: 'available' | 'maybe' } = {}) {
  return {
    discordId,
    discordUsername: discordId,
    scheduleRole: opts.scheduleRole,
    scheduleStatus: opts.scheduleStatus,
    selections: { '2026-09-02': { '20:00': opts.status || 'available' } },
  }
}

// ---------------------------------------------------------------------------
// suggestLineup: trial players must not be auto-placed in main slots
// ---------------------------------------------------------------------------

describe('suggestLineup trial handling', () => {
  const roster = [
    { person: person(1, 'Ankon'), role: 'tank' as const, lastScheduleRole: 'Tank' },
    { person: person(2, 'solstice'), role: 'dps' as const, lastScheduleRole: 'Hitscan' },
    { person: person(3, 'Blueslime'), role: 'dps' as const, lastScheduleRole: 'Hitscan' },
    { person: person(4, 'Alex'), role: 'dps' as const, lastScheduleRole: 'Flex DPS' },
  ]

  it('keeps a rostered player marked tryout out of the main slot and puts them in the trial slot', () => {
    const days = [day([block([
      { role: 'Tank' },
      { role: 'Hitscan' },
      { role: 'Hitscan', isTrial: true },
      { role: 'Flex DPS' },
    ])])]
    const responses = [
      response('d1'),
      response('d2', { scheduleStatus: 'tryout' }),
      response('d3', { scheduleStatus: 'tryout' }),
      response('d4'),
    ]
    const [out] = suggestLineup(days as any, roster as any, [], responses)
    const slots = out.blocks[0].slots
    const main = slots.find(s => s.role === 'Hitscan' && !s.isTrial)!
    const trial = slots.find(s => s.role === 'Hitscan' && s.isTrial)!
    expect(main.playerIds ?? []).toEqual([])
    expect(main.playerId).toBeNull()
    expect(new Set(trial.playerIds)).toEqual(new Set(['2', '3']))
    expect(slots.find(s => s.role === 'Flex DPS')!.playerId).toBe('4')
  })

  it('puts exactly one player on a main slot even when several are available', () => {
    const days = [day([block([
      { role: 'Hitscan' },
      { role: 'Hitscan', isTrial: true },
    ])])]
    const responses = [
      response('d2'),
      response('d3'),
    ]
    const [out] = suggestLineup(days as any, roster as any, [], responses)
    const main = out.blocks[0].slots.find(s => s.role === 'Hitscan' && !s.isTrial)!
    // One seat, one player. The other Hitscan stays on the bench instead of
    // being printed as a second name on the posted roster.
    expect(main.playerIds).toHaveLength(1)
    expect(['2', '3']).toContain(main.playerId)
  })

  it('prefers a main-status player over a sub for a main slot, and uses the sub when nobody else is there', () => {
    const days = [day([block([{ role: 'Hitscan' }])])]
    const withMain = [response('d2', { scheduleStatus: 'sub' }), response('d3')]
    const [a] = suggestLineup(days as any, roster as any, [], withMain)
    expect(a.blocks[0].slots[0].playerIds).toEqual(['3'])

    const onlySub = [response('d1', { scheduleStatus: 'sub' })]
    const [b] = suggestLineup([day([block([{ role: 'Tank' }])])] as any, roster as any, [], onlySub)
    expect(b.blocks[0].slots[0].playerId).toBe('1')
  })

  it('leaves manual picks and ringer slots alone and never offers an assigned player twice', () => {
    const days = [day([block([
      { role: 'Tank', playerIds: ['4'] },
      { role: 'Hitscan' },
      { role: 'Flex DPS', isRinger: true, ringerName: 'Ringer Needed' },
    ])])]
    const responses = [response('d1'), response('d2'), response('d4')]
    const [out] = suggestLineup(days as any, roster as any, [], responses)
    const [tank, hitscan, flex] = out.blocks[0].slots
    expect(tank.playerIds).toEqual(['4'])
    expect(hitscan.playerIds).toEqual(['2'])
    expect(flex.playerIds ?? []).toEqual([])
    expect(flex.isRinger).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Trial rows map broad roles onto the team's preset rows
// ---------------------------------------------------------------------------

describe('computeTrialRoles', () => {
  it('maps a DPS-role trial onto every DPS row of the specific preset', () => {
    const entries = [{ role: 'DPS', scheduleStatus: 'tryout' }]
    expect([...computeTrialRoles(entries, SPECIFIC_ROLES)]).toEqual(['Hitscan', 'Flex DPS'])
  })

  it('only opens the exact row for a specific-role trial', () => {
    const entries = [{ role: 'Hitscan', scheduleStatus: 'tryout' }]
    expect([...computeTrialRoles(entries, SPECIFIC_ROLES)]).toEqual(['Hitscan'])
  })

  it('ignores non-trial players', () => {
    const entries = [{ role: 'Hitscan', scheduleStatus: 'main' }, { role: 'Tank', scheduleStatus: 'sub' }]
    expect(computeTrialRoles(entries, SPECIFIC_ROLES).size).toBe(0)
  })
})

describe('withTrialSlots', () => {
  it('inserts a trial slot directly after its main role and is idempotent', () => {
    const days = [day([block([{ role: 'Tank' }, { role: 'Hitscan' }, { role: 'Flex DPS' }])])]
    const once = withTrialSlots(days as any, new Set(['Hitscan']))
    expect(once.changed).toBe(true)
    expect(once.days[0].blocks[0].slots.map(s => `${s.role}${s.isTrial ? '*' : ''}`)).toEqual(['Tank', 'Hitscan', 'Hitscan*', 'Flex DPS'])
    const twice = withTrialSlots(once.days, new Set(['Hitscan']))
    expect(twice.changed).toBe(false)
    expect(twice.days).toBe(once.days)
  })
})

// ---------------------------------------------------------------------------
// One player per block: assigning to one slot removes them from the others
// ---------------------------------------------------------------------------

describe('setSlotPlayers', () => {
  it('removes the player from any other slot in the same block', () => {
    const b = block([
      { role: 'Hitscan', playerIds: ['2', '3'] },
      { role: 'Hitscan', isTrial: true },
    ])
    const out = setSlotPlayers(b as any, 1, ['2'])
    expect(out.slots[0].playerIds).toEqual(['3'])
    expect(out.slots[0].playerId).toBe('3')
    expect(out.slots[1].playerIds).toEqual(['2'])
    expect(out.slots[1].playerId).toBe('2')
  })

  it('clears a ringer when a real player is assigned', () => {
    const b = { ...block([{ role: 'Tank' }]), slots: [{ role: 'Tank', playerId: null, isRinger: true, ringerName: 'Ringer Needed' }] }
    const out = setSlotPlayers(b as any, 0, ['1'])
    expect(out.slots[0].isRinger).toBe(false)
    expect(out.slots[0].ringerName).toBe('')
  })
})

describe('scheduleHasContent', () => {
  it('is false for an untouched schedule', () => {
    expect(scheduleHasContent([day([block([{ role: 'Tank' }])])] as any)).toBe(false)
  })
  it('is true when an activity or opponent has been set even with no players', () => {
    const d = day([{ ...block([{ role: 'Tank' }]), activity: 'scrim' }])
    expect(scheduleHasContent([d] as any)).toBe(true)
    const d2 = day([{ ...block([{ role: 'Tank' }]), scrim: { opponent: 'Team X' } }])
    expect(scheduleHasContent([d2] as any)).toBe(true)
  })
  it('is true when a ringer is set', () => {
    const d = { ...day([]), blocks: [{ id: 'x', time: '8-10', slots: [{ role: 'Tank', playerId: null, isRinger: true, ringerName: 'Bob' }] }] }
    expect(scheduleHasContent([d] as any)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Re-submitting availability must not wipe manager-set role/status
// ---------------------------------------------------------------------------

describe('mergeAvailabilityResponse', () => {
  it('keeps scheduleRole and scheduleStatus from the existing response', () => {
    const existing = { discordId: 'd2', discordUsername: 'old', respondedAt: 'x', selections: {}, scheduleRole: 'Hitscan', scheduleStatus: 'tryout' }
    const incoming = { discordId: 'd2', discordUsername: 'solstice', respondedAt: 'y', selections: { '2026-09-02': { '20:00': 'available' as const } } }
    const merged = mergeAvailabilityResponse(existing, incoming)
    expect(merged.scheduleRole).toBe('Hitscan')
    expect(merged.scheduleStatus).toBe('tryout')
    expect(merged.discordUsername).toBe('solstice')
    expect(merged.selections).toEqual(incoming.selections)
  })

  it('returns the incoming response untouched when there is no existing one', () => {
    const incoming = { discordId: 'd2', discordUsername: 'solstice', respondedAt: 'y', selections: {} }
    expect(mergeAvailabilityResponse(undefined, incoming)).toEqual(incoming)
  })
})

// ---------------------------------------------------------------------------
// Discord publish: split long schedules across multiple messages
// ---------------------------------------------------------------------------

describe('packDiscordMessages', () => {
  it('keeps everything in one message when it fits', () => {
    const msgs = packDiscordMessages('**Week**', ['a', 'b'])
    expect(msgs).toEqual(['**Week**\n\na\n\nb'])
  })

  it('splits at chunk boundaries so no message exceeds the limit', () => {
    const chunk = '```\n' + 'x'.repeat(600) + '\n```'
    const msgs = packDiscordMessages('**Week**', Array.from({ length: 7 }, () => chunk))
    expect(msgs.length).toBeGreaterThan(1)
    for (const m of msgs) expect(m.length).toBeLessThanOrEqual(DISCORD_MESSAGE_LIMIT)
    expect(msgs.join('\n')).toContain('**Week**')
    // Every chunk survives, in order
    expect(msgs.join('\n\n').split(chunk).length - 1).toBe(7)
  })

  it('hard-truncates a single chunk that is itself over the limit without breaking the code fence', () => {
    const chunk = '**Day**\n```\n' + 'y'.repeat(2500) + '\n```'
    const [msg] = packDiscordMessages('**Week**', [chunk])
    expect(msg.length).toBeLessThanOrEqual(DISCORD_MESSAGE_LIMIT)
    expect(msg.endsWith('```')).toBe(true)
  })
})

describe('formatScheduleChunks', () => {
  it('produces one chunk per non-free block and lists trials separately', () => {
    const schedule = {
      days: [
        {
          date: 'Wednesday Sep 2', enabled: true,
          blocks: [
            { id: '1', time: '8-10', activity: 'scrim', scrim: { opponent: 'Team X', host: 'us' }, slots: [
              { role: 'Tank', playerId: '1' },
              { role: 'Hitscan', playerId: null },
              { role: 'Hitscan', playerId: '2', isTrial: true },
            ] },
            { id: '2', time: '10-12', activity: 'free', slots: [] },
          ],
        },
        { date: 'Thursday Sep 3', enabled: true, blocks: [{ id: '3', time: '8-10', activity: 'vod', slots: [{ role: 'Tank', playerId: '1' }] }] },
      ],
    }
    const map = new Map([['1', 'Ankon'], ['2', 'solstice']])
    const { header, chunks } = formatScheduleChunks(schedule as any, map, 'Week of Aug 31', '8-10')
    expect(header).toBe('**Week of Aug 31**')
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toContain('vs Team X - We host')
    expect(chunks[0]).toContain('--- Trials ---')
    expect(chunks[0]).toContain('solstice')
    expect(chunks[1]).toContain('VOD Review')
  })

  it('returns no chunks when nothing is scheduled', () => {
    const { chunks } = formatScheduleChunks({ days: [{ date: 'x', enabled: true, blocks: [{ id: '1', time: '8-10', slots: [] }] }] } as any, new Map(), 'W', '8-10')
    expect(chunks).toHaveLength(0)
  })
})
