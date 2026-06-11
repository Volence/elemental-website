import { describe, it, expect } from 'vitest'
import { userMention, subjectLabel, accountCreatedAtMs, accountAgeDays, isNewAccount } from '@/discord/logging/identity'

describe('identity helpers', () => {
  it('builds a clickable mention', () => {
    expect(userMention('123')).toBe('<@123>')
  })
  it('builds the embed identity line: readable name first, mention second', () => {
    expect(subjectLabel('ameliah', '123')).toBe('**ameliah** (<@123>)')
  })
  it('derives account creation time from the snowflake', () => {
    const created = 1700000000000
    const snowflake = String((BigInt(created - 1420070400000) << 22n))
    expect(accountCreatedAtMs(snowflake)).toBe(created)
  })
  it('flags accounts younger than the threshold', () => {
    const nowMs = 1700000000000
    const created = nowMs - 2 * 86400000
    const snowflake = String((BigInt(created - 1420070400000) << 22n))
    expect(accountAgeDays(snowflake, nowMs)).toBe(2)
    expect(isNewAccount(snowflake, 7, nowMs)).toBe(true)
    expect(isNewAccount(snowflake, 1, nowMs)).toBe(false)
  })
})
