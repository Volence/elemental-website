import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestDelete } from '@/utilities/requestDelete'

function mockFetch(response: Partial<Response> & { json?: () => Promise<any> }) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestDelete', () => {
  it('sends a DELETE and returns null on success', async () => {
    const fn = mockFetch({ ok: true, status: 200 })
    const err = await requestDelete('/api/teams/7')
    expect(err).toBeNull()
    expect(fn).toHaveBeenCalledWith('/api/teams/7', expect.objectContaining({ method: 'DELETE' }))
  })

  it('returns a permission message on 403 instead of pretending success', async () => {
    mockFetch({ ok: false, status: 403, json: async () => ({ errors: [{ message: 'You are not allowed to perform this action.' }] }) })
    const err = await requestDelete('/api/teams/7')
    expect(err).toBe('You are not allowed to perform this action.')
  })

  it('falls back to a status-based message when the body has no error text', async () => {
    mockFetch({ ok: false, status: 500, json: async () => { throw new Error('not json') } })
    const err = await requestDelete('/api/teams/7')
    expect(err).toMatch(/500/)
  })

  it('surfaces network failures as a message rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const err = await requestDelete('/api/teams/7')
    expect(err).toBe('Failed to fetch')
  })
})
