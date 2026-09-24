// @vitest-environment node
/**
 * PUG team voice: players in voice are moved into their team channel at match
 * start, and when the match ends only those still sitting in a team channel are
 * handed back (to where they came from, else the PUG lobby channel). Someone who
 * left on their own - say during the two-minute result vote - is never moved again.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Collection } from 'discord.js'

const GUILD_ID = 'guild'
const LOBBY_VOICE = 'pugs-general'
process.env.DISCORD_GUILD_ID = GUILD_ID
process.env.DISCORD_PUG_LOBBY_VOICE_CHANNEL_ID = LOBBY_VOICE

// ── Fake Discord guild ──
const voice = new Collection<string, { channelId: string | null }>()
const channels = new Map<string, { id: string; delete: () => Promise<void> }>()
const unmovable = new Set<string>()
const moves: [string, string][] = []
let readyTimestamp = 0

function addChannel(id: string) {
  channels.set(id, { id, delete: async () => { channels.delete(id); for (const [u, s] of voice) if (s.channelId === id) voice.delete(u) } })
}

const guild = {
  get client() { return { readyTimestamp } },
  voiceStates: { cache: voice },
  members: {
    edit: vi.fn(async (userId: string, { channel }: { channel: string }) => {
      if (unmovable.has(userId)) throw new Error('Missing Permissions')
      moves.push([userId, channel])
      voice.set(userId, { channelId: channel })
    }),
  },
  channels: { cache: channels, fetch: async (id: string) => channels.get(id) ?? null },
}

vi.mock('@/discord/bot', () => ({
  ensureDiscordClient: async () => null,
  getDiscordClient: () => ({ isReady: () => true, guilds: { cache: new Map([[GUILD_ID, guild]]), fetch: async () => guild } }),
}))

// ── In-memory prisma, evaluating the where shapes the sweep uses ──
type Lobby = Record<string, any>
const lobbies: Lobby[] = []
function matches(row: Lobby, where: any): boolean {
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === 'OR') return cond.some((w: any) => matches(row, w))
    if (key === 'AND') return cond.every((w: any) => matches(row, w))
    const v = row[key] ?? null
    if ('not' in cond) return v !== cond.not
    if ('notIn' in cond) return !cond.notIn.includes(v)
    if ('lt' in cond) return v !== null && v < cond.lt
    throw new Error(`unhandled where ${key}`)
  })
}
vi.mock('@/lib/prisma', () => ({
  default: {
    pugLobby: {
      findMany: async ({ where }: any) => lobbies.filter((l) => matches(l, where)).map((l) => ({ ...l })),
      update: async ({ where, data }: any) => Object.assign(lobbies.find((l) => l.id === where.id)!, data),
    },
  },
}))

const { moveTeamsIntoVoice, sweepPugVoice } = await import('@/discord/services/pugVoice')

const T0 = 1_000_000_000_000
const SETTLED = T0 + 60_000

function lobby(extra: Lobby): Lobby {
  const row = { id: lobbies.length + 1, lobbyNumber: 129, status: 'COMPLETED', voiceChannel1Id: 't1', voiceChannel2Id: 't2', voiceOrigins: {}, voiceStartedAt: new Date(T0), voiceEndedAt: null, ...extra }
  lobbies.push(row)
  return row
}

beforeEach(() => {
  voice.clear(); channels.clear(); unmovable.clear(); moves.length = 0; lobbies.length = 0
  readyTimestamp = T0
  ;['t1', 't2', 'general', 'duo', LOBBY_VOICE].forEach(addChannel)
})

describe('moving players into team voice', () => {
  it('moves only players already in voice, remembering where they were', async () => {
    voice.set('a', { channelId: 'general' })
    voice.set('b', { channelId: 'duo' })
    const origins = await moveTeamsIntoVoice([
      { channelId: 't1', userIds: ['a', 'c'] }, // c is not in voice
      { channelId: 't2', userIds: ['b'] },
    ])
    expect(origins).toEqual({ a: 'general', b: 'duo' })
    expect(moves).toEqual([['a', 't1'], ['b', 't2']])
  })

  it('keeps the original origin when a restarted lobby moves someone out of its old team channel', async () => {
    addChannel('old1')
    voice.set('a', { channelId: 'old1' })
    const origins = await moveTeamsIntoVoice([{ channelId: 't1', userIds: ['a'] }], { origins: { a: 'general' }, channelIds: ['old1'] })
    expect(origins).toEqual({ a: 'general' })
  })
})

describe('handing players back when the match ends', () => {
  it('returns only players still in the team channels, then deletes the empty channels', async () => {
    const row = lobby({ voiceOrigins: { a: 'general', b: 'duo', d: 'general' } })
    voice.set('a', { channelId: 't1' }) // still in team voice: back to general
    voice.set('e', { channelId: 't2' }) // joined from outside voice: no origin, goes to the lobby channel
    voice.set('b', { channelId: 'duo' }) // left on their own during the vote: untouched
    // d left voice entirely: untouched

    await sweepPugVoice(SETTLED)

    expect(moves).toEqual([['a', 'general'], ['e', LOBBY_VOICE]])
    expect(voice.get('b')?.channelId).toBe('duo')
    expect(voice.has('d')).toBe(false)
    expect(channels.has('t1') || channels.has('t2')).toBe(false)
    expect(row.voiceChannel1Id).toBeNull()
  })

  it('does nothing while the bot has only just connected and its voice cache is cold', async () => {
    const row = lobby({ voiceOrigins: { a: 'general' } })
    voice.set('a', { channelId: 't1' })
    await sweepPugVoice(T0 + 5_000)
    expect(moves).toEqual([])
    expect(row.voiceEndedAt).toBeNull()
    expect(channels.has('t1')).toBe(true)
  })

  it('leaves a match that is still being played alone', async () => {
    lobby({ status: 'IN_PROGRESS', voiceStartedAt: new Date(SETTLED - 60_000) })
    voice.set('a', { channelId: 't1' })
    await sweepPugVoice(SETTLED)
    expect(moves).toEqual([])
    expect(channels.has('t1')).toBe(true)
  })

  it('hands back a disputed match too - the game is over', async () => {
    lobby({ status: 'DISPUTED', voiceOrigins: { a: 'general' } })
    voice.set('a', { channelId: 't1' })
    await sweepPugVoice(SETTLED)
    expect(moves).toEqual([['a', 'general']])
  })

  it('keeps an occupied channel for ten minutes, then deletes it regardless', async () => {
    const row = lobby({})
    unmovable.add('x')
    voice.set('x', { channelId: 't1' })

    await sweepPugVoice(SETTLED)
    expect(channels.has('t1')).toBe(true)
    expect(row.voiceEndedAt).not.toBeNull()

    await sweepPugVoice(SETTLED + 9 * 60_000)
    expect(channels.has('t1')).toBe(true)

    await sweepPugVoice(SETTLED + 10 * 60_000)
    expect(channels.has('t1')).toBe(false)
    expect(row.voiceChannel1Id).toBeNull()
  })

  it('does not move anyone a second time on a later pass', async () => {
    lobby({ voiceOrigins: { a: 'general' } })
    unmovable.add('x')
    voice.set('x', { channelId: 't2' }) // keeps the channels alive past the first pass
    voice.set('a', { channelId: 't1' })
    await sweepPugVoice(SETTLED)
    expect(moves).toEqual([['a', 'general']])
    voice.set('a', { channelId: 'duo' }) // a wanders off afterwards
    await sweepPugVoice(SETTLED + 30_000)
    expect(moves).toEqual([['a', 'general']])
  })

  it('cleans up a match nobody finished after two hours', async () => {
    lobby({ status: 'IN_PROGRESS', voiceStartedAt: new Date(SETTLED - 2 * 3600_000 - 1), voiceOrigins: { a: 'general' } })
    voice.set('a', { channelId: 't1' })
    await sweepPugVoice(SETTLED)
    expect(moves).toEqual([['a', 'general']])
    expect(channels.has('t1')).toBe(false)
  })

  it('clears a finished lobby whose channels were already deleted by hand', async () => {
    channels.delete('t1'); channels.delete('t2')
    const row = lobby({})
    await sweepPugVoice(SETTLED)
    expect(row.voiceChannel1Id).toBeNull()
    expect(row.voiceChannel2Id).toBeNull()
  })
})
