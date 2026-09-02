import { describe, it, expect } from 'vitest'
import { createSessionRow } from '@/auth/session'

function fakeDb() {
  const statements: string[] = []
  return {
    statements,
    async execute(query: any) {
      // drizzle sql`` objects expose queryChunks; stringify for assertions
      const text = query?.queryChunks ? query.queryChunks.map((c: any) => (typeof c === 'string' ? c : c?.value?.join?.('') ?? '?')).join('') : String(query)
      statements.push(text)
      if (text.includes('MAX(_order)')) return { rows: [{ next_order: 3 }] }
      return { rows: [] }
    },
  }
}

describe('createSessionRow', () => {
  it('prunes expired sessions, picks the next order, inserts one row', async () => {
    const db = fakeDb()
    const now = new Date('2026-09-02T12:00:00.000Z')
    const { sid, expiresAt } = await createSessionRow(db, 42, 28800, now)
    expect(sid).toMatch(/^[0-9a-f-]{36}$/)
    expect(expiresAt.toISOString()).toBe('2026-09-02T20:00:00.000Z')
    expect(db.statements[0]).toContain('DELETE FROM people_sessions')
    expect(db.statements[1]).toContain('MAX(_order)')
    expect(db.statements[2]).toContain('INSERT INTO people_sessions')
    expect(db.statements).toHaveLength(3)
  })
})
