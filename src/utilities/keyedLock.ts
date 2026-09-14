/**
 * One-at-a-time work per key, inside this server process.
 *
 * A match save rewrites the whole production workflow (every signup and assignment list), so two
 * saves of one match that overlap either lose one another's change or, on Postgres, insert the
 * same array row twice. Wrapping each read-change-write of a match in `withKeyedLock('match:ID')`
 * makes them queue instead. Production runs a single app container, so a process-local lock
 * covers every writer that goes through it.
 *
 * The map lives on globalThis so every route bundle shares one set of locks.
 */

const store = globalThis as typeof globalThis & { __keyedLocks?: Map<string, Promise<void>> }
const tails: Map<string, Promise<void>> = (store.__keyedLocks ??= new Map())

export async function withKeyedLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve()
  let release!: () => void
  const done = new Promise<void>((resolve) => { release = resolve })
  const tail = previous.then(() => done)
  tails.set(key, tail)
  try {
    await previous
    return await work()
  } finally {
    release()
    if (tails.get(key) === tail) tails.delete(key)
  }
}
