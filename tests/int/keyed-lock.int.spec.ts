import { describe, it, expect } from 'vitest'
import { withKeyedLock } from '@/utilities/keyedLock'

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('withKeyedLock', () => {
  it('runs work on the same key one at a time, in arrival order', async () => {
    const events: string[] = []
    const job = (name: string) => withKeyedLock('match:1', async () => {
      events.push(`${name}:start`)
      await tick()
      events.push(`${name}:end`)
      return name
    })
    const results = await Promise.all([job('a'), job('b'), job('c')])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
  })

  it('lets different keys run side by side', async () => {
    const events: string[] = []
    const job = (key: string) => withKeyedLock(key, async () => {
      events.push(`${key}:start`)
      await tick()
      events.push(`${key}:end`)
    })
    await Promise.all([job('match:1'), job('match:2')])
    expect(events.slice(0, 2).sort()).toEqual(['match:1:start', 'match:2:start'])
  })

  it('releases the key when the work throws', async () => {
    await expect(withKeyedLock('match:3', async () => { throw new Error('boom') })).rejects.toThrow('boom')
    await expect(withKeyedLock('match:3', async () => 'after')).resolves.toBe('after')
  })
})
