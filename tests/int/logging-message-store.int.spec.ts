import { describe, it, expect } from 'vitest'
import { isPrunable, RETENTION_DAYS } from '@/discord/logging/messageStore'

describe('message store retention', () => {
  const nowMs = 1700000000000

  it('keeps messages inside the retention window', () => {
    expect(isPrunable(nowMs - (RETENTION_DAYS - 1) * 86400000, nowMs)).toBe(false)
  })

  it('prunes messages older than the retention window', () => {
    expect(isPrunable(nowMs - (RETENTION_DAYS + 1) * 86400000, nowMs)).toBe(true)
  })

  it('respects a custom retention', () => {
    const sentAt = nowMs - 10 * 86400000
    expect(isPrunable(sentAt, nowMs, 7)).toBe(true)
    expect(isPrunable(sentAt, nowMs, 14)).toBe(false)
  })
})
