import { beforeEach, describe, expect, it, vi } from 'vitest'

const channels = vi.hoisted(() => new Map<string, any>())

vi.mock('@/discord/bot', () => ({
  ensureDiscordClient: vi.fn(async () => ({ channels: { fetch: async (id: string) => channels.get(id) } })),
  getDiscordClient: vi.fn(() => ({})),
}))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { postProductionSchedule } from '@/discord/services/productionSchedulePost'

/** Discord with some latency, so overlapping writers really do overlap. */
function fakeChannel() {
  const history: Array<{ id: string; content: string }> = []
  let nextId = 1
  const toMessage = (entry: { id: string; content: string }) => ({
    id: entry.id,
    edit: async (next: any) => {
      entry.content = typeof next === 'string' ? next : next.content
      return toMessage(entry)
    },
    delete: async () => {
      history.splice(history.indexOf(entry), 1)
    },
  })
  return {
    history,
    send: async (next: any) => {
      await new Promise((r) => setTimeout(r, 5))
      const entry = { id: String(nextId++), content: typeof next === 'string' ? next : next.content }
      history.push(entry)
      return toMessage(entry)
    },
    messages: {
      fetch: async (id: string) => {
        const entry = history.find((m) => m.id === id)
        if (!entry) throw new Error('Unknown Message')
        return toMessage(entry)
      },
    },
  }
}

function fakePayload() {
  const global: any = { scheduleStaffChannelId: 'staff', schedulePublicChannelId: 'public', schedulePost: {} }
  return {
    findGlobal: async () => structuredClone(global),
    updateGlobal: async ({ data }: any) => {
      global.schedulePost = data.schedulePost
    },
    find: async () => ({ docs: [] }),
  } as any
}

describe('postProductionSchedule', () => {
  beforeEach(() => {
    channels.clear()
    channels.set('staff', fakeChannel())
    channels.set('public', fakeChannel())
  })

  it('leaves one post in each channel when two writers overlap', async () => {
    const payload = fakePayload()
    await Promise.all([
      postProductionSchedule(payload, { mode: 'update' }),
      postProductionSchedule(payload, { mode: 'new' }),
    ])
    expect(channels.get('staff').history).toHaveLength(1)
    expect(channels.get('public').history).toHaveLength(1)
  })

  it('does not repeat the staff post when the public channel failed last time', async () => {
    const payload = fakePayload()
    const send = channels.get('public').send
    channels.get('public').send = async () => {
      throw new Error('Missing Permissions')
    }
    await expect(postProductionSchedule(payload, { mode: 'update' })).rejects.toThrow('Missing Permissions')
    channels.get('public').send = send
    await postProductionSchedule(payload, { mode: 'update' })
    expect(channels.get('staff').history).toHaveLength(1)
    expect(channels.get('public').history).toHaveLength(1)
  })

  it('replaces the previous post when a new week starts', async () => {
    const payload = fakePayload()
    await postProductionSchedule(payload, { mode: 'new' })
    await postProductionSchedule(payload, { mode: 'new' })
    expect(channels.get('staff').history).toHaveLength(1)
    expect(channels.get('public').history).toHaveLength(1)
  })
})
