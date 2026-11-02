import { describe, expect, it } from 'vitest'
import { formatScheduleChunks, withoutTrialCoveredSlots } from '@/discord/handlers/schedule-format'

const slot = (role: string, playerId: string | null, isTrial = false) => ({ role, playerId, isTrial })

describe('withoutTrialCoveredSlots', () => {
  it('drops the empty row a trial is filling, and keeps real gaps', () => {
    const slots = [slot('Tank', null), slot('Hitscan', '1'), slot('Flex DPS', null), slot('Tank', '2', true)]
    expect(withoutTrialCoveredSlots(slots).map((s) => s.role)).toEqual(['Hitscan', 'Flex DPS', 'Tank'])
  })

  it('covers one empty row per trial player', () => {
    const slots = [slot('DPS', null), slot('DPS', null), slot('DPS', '1', true)]
    expect(withoutTrialCoveredSlots(slots).filter((s) => !s.isTrial)).toHaveLength(1)
  })

  it('keeps a ringer row', () => {
    const slots = [{ ...slot('Tank', null), isRinger: true, ringerName: 'Ringer Needed' }, slot('Tank', '1', true)]
    expect(withoutTrialCoveredSlots(slots)).toHaveLength(2)
  })
})

describe('the team calendar post', () => {
  it('shows no empty row for a trial-filled role', () => {
    const { chunks } = formatScheduleChunks(
      {
        days: [{
          date: 'Monday Nov 2',
          enabled: true,
          blocks: [{ id: 'a', time: '8-10 PM', activity: 'vod', slots: [slot('Tank', null), slot('Hitscan', '1'), slot('Tank', '2', true)] }],
        }],
      } as any,
      new Map([['1', 'WinterYoshi'], ['2', 'Goldinette']]),
      'Week',
      '',
    )
    expect(chunks.join('\n')).not.toMatch(/Tank\s+-/)
    expect(chunks.join('\n')).toMatch(/Tank\s+Goldinette/)
  })
})
