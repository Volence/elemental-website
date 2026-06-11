import { describe, it, expect } from 'vitest'
import { announceableDowntimeSeconds, MIN_ANNOUNCE_GAP_SECONDS } from '@/discord/logging/heartbeat'

describe('heartbeat gap decision', () => {
  const nowMs = 1700000000000

  it('stays silent on a fresh boot / deploy (no disconnect recorded)', () => {
    expect(announceableDowntimeSeconds(null, nowMs)).toBeNull()
  })

  it('stays silent for sub-threshold blips', () => {
    const disconnectAt = nowMs - (MIN_ANNOUNCE_GAP_SECONDS - 1) * 1000
    expect(announceableDowntimeSeconds(disconnectAt, nowMs)).toBeNull()
  })

  it('announces a real gap with the downtime in seconds', () => {
    const disconnectAt = nowMs - 300_000
    expect(announceableDowntimeSeconds(disconnectAt, nowMs)).toBe(300)
  })

  it('announces exactly at the threshold', () => {
    const disconnectAt = nowMs - MIN_ANNOUNCE_GAP_SECONDS * 1000
    expect(announceableDowntimeSeconds(disconnectAt, nowMs)).toBe(MIN_ANNOUNCE_GAP_SECONDS)
  })

  it('respects a custom threshold', () => {
    const disconnectAt = nowMs - 90_000
    expect(announceableDowntimeSeconds(disconnectAt, nowMs, 120)).toBeNull()
    expect(announceableDowntimeSeconds(disconnectAt, nowMs, 30)).toBe(90)
  })
})
