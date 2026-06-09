import { describe, it, expect } from 'vitest'
import { resolveLogChannelId, type LoggingConfig, type LogCategory } from '@/discord/logging/channels'

const cfg: LoggingConfig = {
  enableLogging: true,
  messageLogChannelId: 'MSG',
  joinLeaveLogChannelId: 'JOIN',
  memberLogChannelId: 'MEMBER',
  profileLogChannelId: 'PROFILE',
  serverLogChannelId: 'SERVER',
  newAccountFlagDays: 7,
  attachProfileLink: true,
}

describe('resolveLogChannelId', () => {
  it('maps each category to its configured channel', () => {
    expect(resolveLogChannelId(cfg, 'message')).toBe('MSG')
    expect(resolveLogChannelId(cfg, 'joinLeave')).toBe('JOIN')
    expect(resolveLogChannelId(cfg, 'member')).toBe('MEMBER')
    expect(resolveLogChannelId(cfg, 'profile')).toBe('PROFILE')
    expect(resolveLogChannelId(cfg, 'server')).toBe('SERVER')
  })
  it('returns null when logging is disabled', () => {
    expect(resolveLogChannelId({ ...cfg, enableLogging: false }, 'message')).toBeNull()
  })
  it('returns null when the category channel is blank', () => {
    expect(resolveLogChannelId({ ...cfg, profileLogChannelId: '' }, 'profile')).toBeNull()
  })
})
