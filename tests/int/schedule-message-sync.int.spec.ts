import { describe, expect, it, vi } from 'vitest'

vi.mock('@/discord/bot', () => ({ ensureDiscordClient: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

import { syncScheduleMessages } from '@/discord/handlers/publish-schedule'

/** A channel whose messages are kept in send order, like Discord's history. */
function fakeChannel(initial: string[]) {
  let nextId = 100
  const history: Array<{ id: string; content: string }> = initial.map((content, i) => ({ id: String(i + 1), content }))
  const toMessage = (entry: { id: string; content: string }) => ({
    id: entry.id,
    edit: async (content: any) => {
      entry.content = typeof content === 'string' ? content : content.content
      return toMessage(entry)
    },
    delete: async () => {
      const i = history.indexOf(entry)
      if (i >= 0) history.splice(i, 1)
    },
  })
  const channel = {
    messages: {
      fetch: async (id: string) => {
        const entry = history.find((m) => m.id === id)
        if (!entry) throw new Error('Unknown Message')
        return toMessage(entry)
      },
    },
    send: async (content: any) => {
      const entry = { id: String(nextId++), content: typeof content === 'string' ? content : content.content }
      history.push(entry)
      return toMessage(entry)
    },
  }
  return { channel: channel as any, history }
}

describe('syncScheduleMessages', () => {
  it('edits in place when the post still fits in the messages it has', async () => {
    const { channel, history } = fakeChannel(['old A', 'old B', 'chat'])
    const ids = await syncScheduleMessages(channel, ['1', '2'], ['new A'])
    expect(ids).toEqual(['1'])
    expect(history.map((m) => m.content)).toEqual(['new A', 'chat'])
  })

  it('sends the whole post again when it grows, so its parts stay together', async () => {
    const { channel, history } = fakeChannel(['old A', 'chat'])
    const ids = await syncScheduleMessages(channel, ['1'], ['new A', 'new B'])
    expect(ids).toEqual(['100', '101'])
    expect(history.map((m) => m.content)).toEqual(['chat', 'new A', 'new B'])
  })

  it('sends the whole post again when one of its messages was deleted', async () => {
    const { channel, history } = fakeChannel(['old A', 'chat'])
    const ids = await syncScheduleMessages(channel, ['1', 'gone'], ['new A', 'new B'])
    expect(ids).toEqual(['100', '101'])
    expect(history.map((m) => m.content)).toEqual(['chat', 'new A', 'new B'])
  })

  it('sends fresh messages when nothing was posted yet', async () => {
    const { channel, history } = fakeChannel([])
    expect(await syncScheduleMessages(channel, [], ['A'])).toEqual(['100'])
    expect(history.map((m) => m.content)).toEqual(['A'])
  })
})

describe('syncScheduleMessages with replace', () => {
  it('sends the post fresh and deletes the old copy, even when it would fit', async () => {
    const { channel, history } = fakeChannel(['old A', 'old B', 'chat'])
    const ids = await syncScheduleMessages(channel, ['1', '2'], ['new A'], { replace: true })
    expect(ids).toEqual(['100'])
    expect(history.map((m) => m.content)).toEqual(['chat', 'new A'])
  })
})
