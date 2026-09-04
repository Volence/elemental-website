import { describe, it, expect } from 'vitest'
import { planTwitchSync, twitchLoginFromLink } from '@/collections/People/hooks/syncTwitchStreamer'

const person = 42
const own = { id: 1, twitchUsername: 'j4cob', active: true, person }

describe('twitchLoginFromLink', () => {
  it('accepts URLs, handles and bare names', () => {
    expect(twitchLoginFromLink('https://www.twitch.tv/J4COB/')).toBe('j4cob')
    expect(twitchLoginFromLink('twitch.tv/j4cob?ref=x')).toBe('j4cob')
    expect(twitchLoginFromLink('@J4cob')).toBe('j4cob')
    expect(twitchLoginFromLink('  ')).toBeNull()
    expect(twitchLoginFromLink(null)).toBeNull()
    expect(twitchLoginFromLink('https://youtube.com/@j4cob')).toBeNull()
  })
})

describe('planTwitchSync', () => {
  it('creates an INACTIVE player row when an unapproved person adds a Twitch link', () => {
    const a = planTwitchSync({ personId: person, previousLink: null, nextLink: 'https://twitch.tv/j4cob', approved: false, linkedRow: null, rowForLogin: null })
    expect(a).toEqual({ type: 'create', data: { twitchUsername: 'j4cob', category: 'player', person, active: false, isLive: false } })
  })

  it('links an admin-created row for the same channel instead of duplicating it', () => {
    const a = planTwitchSync({ personId: person, previousLink: null, nextLink: 'j4cob', approved: true, linkedRow: null, rowForLogin: { id: 9, twitchUsername: 'j4cob', active: false, person: null } })
    expect(a).toEqual({ type: 'update', id: 9, data: { person, active: true } })
  })

  it('leaves a channel that belongs to someone else alone', () => {
    const a = planTwitchSync({ personId: person, previousLink: null, nextLink: 'j4cob', approved: true, linkedRow: null, rowForLogin: { id: 9, twitchUsername: 'j4cob', person: 7 } })
    expect(a).toEqual({ type: 'none' })
  })

  it('does nothing when the link is unchanged and the row is active', () => {
    expect(planTwitchSync({ personId: person, previousLink: 'twitch.tv/j4cob', nextLink: 'https://twitch.tv/J4COB', approved: true, linkedRow: own, rowForLogin: own })).toEqual({ type: 'none' })
  })

  it('re-activates and re-points the row when the channel changes', () => {
    const a = planTwitchSync({ personId: person, previousLink: 'twitch.tv/j4cob', nextLink: 'twitch.tv/j4cob_ow', approved: true, linkedRow: own, rowForLogin: null })
    expect(a).toEqual({ type: 'update', id: 1, data: { twitchUsername: 'j4cob_ow', twitchUserId: null, active: true } })
  })

  it('a manager approval switches the row on, revoking it switches the row off', () => {
    const pending = { ...own, active: false }
    expect(planTwitchSync({ personId: person, previousLink: 'twitch.tv/j4cob', nextLink: 'twitch.tv/j4cob', approved: true, linkedRow: pending, rowForLogin: pending })).toEqual({ type: 'update', id: 1, data: { active: true } })
    expect(planTwitchSync({ personId: person, previousLink: 'twitch.tv/j4cob', nextLink: 'twitch.tv/j4cob', approved: false, linkedRow: own, rowForLogin: own })).toEqual({ type: 'update', id: 1, data: { active: false } })
  })

  it('deactivates the row when the link is cleared, and only then', () => {
    expect(planTwitchSync({ personId: person, previousLink: 'twitch.tv/j4cob', nextLink: '', approved: true, linkedRow: own, rowForLogin: null })).toEqual({ type: 'deactivate', id: 1 })
    expect(planTwitchSync({ personId: person, previousLink: null, nextLink: '', approved: true, linkedRow: own, rowForLogin: null })).toEqual({ type: 'none' })
  })
})
