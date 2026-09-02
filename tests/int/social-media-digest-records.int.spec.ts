import { describe, it, expect } from 'vitest'
import {
  findDigestRecord,
  upsertDigestRecord,
  buildDailyPing,
  shouldSendDailyPing,
  type DigestRecord,
} from '@/utilities/socialMediaDigest'

describe('digest records', () => {
  const records: DigestRecord[] = [
    { weekStart: '2026-08-23', channelId: '1', messageId: 'm1', sentAt: '2026-08-23T00:00:00.000Z' },
    { weekStart: '2026-08-30', channelId: '1', messageId: 'm2', sentAt: '2026-08-30T00:00:00.000Z' },
  ]

  it('finds the record for a week start', () => {
    expect(findDigestRecord(records, '2026-08-30')?.messageId).toBe('m2')
    expect(findDigestRecord(records, '2026-09-06')).toBeNull()
    expect(findDigestRecord(undefined, '2026-08-30')).toBeNull()
  })

  it('replaces an existing week and keeps the list bounded', () => {
    const next = upsertDigestRecord(records, {
      weekStart: '2026-08-30', channelId: '1', messageId: 'm3', sentAt: '2026-09-01T00:00:00.000Z',
    })
    expect(next).toHaveLength(2)
    expect(findDigestRecord(next, '2026-08-30')?.messageId).toBe('m3')
    // never grows past 26 weeks
    let many: DigestRecord[] = []
    for (let i = 0; i < 40; i++) {
      many = upsertDigestRecord(many, { weekStart: `2025-01-${String(i + 1).padStart(2, '0')}`, channelId: '1', messageId: `x${i}`, sentAt: '' })
    }
    expect(many.length).toBeLessThanOrEqual(26)
    expect(many[many.length - 1].messageId).toBe('x39')
  })
})

describe('buildDailyPing', () => {
  const tasks = [
    { title: 'Merch Post', dueDate: '2026-09-03T00:00:00.000Z', status: 'backlog', assignees: [{ name: 'Tycho', discordId: '111111111111111111' }] },
    { title: 'Done already', dueDate: '2026-09-03T00:00:00.000Z', status: 'complete', assignees: [] },
    { title: 'Tomorrow', dueDate: '2026-09-04T00:00:00.000Z', status: 'backlog', assignees: [] },
  ]

  it('lists only unfinished posts due that day with mentions', () => {
    const text = buildDailyPing({ dateKey: '2026-09-03', tasks })
    expect(text).not.toBeNull()
    expect(text).toContain('**Posts due today')
    expect(text).toContain('Thu, Sep 3')
    expect(text).toContain('- **Merch Post** - <@111111111111111111>')
    expect(text).not.toContain('Done already')
    expect(text).not.toContain('Tomorrow')
  })

  it('returns null when nothing is due so the channel is not spammed', () => {
    expect(buildDailyPing({ dateKey: '2026-09-10', tasks })).toBeNull()
  })
})

describe('shouldSendDailyPing', () => {
  const base = { enabled: true, channelId: '123', time: '09:00', lastSentDate: null as string | null }

  it('fires once the configured time has passed and not yet sent today', () => {
    expect(shouldSendDailyPing({ ...base, nowLocal: { dateKey: '2026-09-03', hhmm: '09:00' } })).toBe(true)
    expect(shouldSendDailyPing({ ...base, nowLocal: { dateKey: '2026-09-03', hhmm: '13:37' } })).toBe(true)
  })

  it('does not fire before the time, when disabled, unconfigured, or already sent today', () => {
    expect(shouldSendDailyPing({ ...base, nowLocal: { dateKey: '2026-09-03', hhmm: '08:59' } })).toBe(false)
    expect(shouldSendDailyPing({ ...base, enabled: false, nowLocal: { dateKey: '2026-09-03', hhmm: '10:00' } })).toBe(false)
    expect(shouldSendDailyPing({ ...base, channelId: '', nowLocal: { dateKey: '2026-09-03', hhmm: '10:00' } })).toBe(false)
    expect(shouldSendDailyPing({ ...base, lastSentDate: '2026-09-03', nowLocal: { dateKey: '2026-09-03', hhmm: '10:00' } })).toBe(false)
    expect(shouldSendDailyPing({ ...base, lastSentDate: '2026-09-02', nowLocal: { dateKey: '2026-09-03', hhmm: '10:00' } })).toBe(true)
  })
})
