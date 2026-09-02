import { describe, it, expect } from 'vitest'
import { safeReturnPath } from '@/auth/safeReturnPath'

const SERVER_URL = 'http://localhost:3000'

describe('safeReturnPath', () => {
  it('accepts a plain path', () => {
    expect(safeReturnPath('/admin', SERVER_URL)).toBe('/admin')
  })

  it('preserves query string and hash', () => {
    expect(safeReturnPath('/schedule/bug?x=1#y', SERVER_URL)).toBe('/schedule/bug?x=1#y')
  })

  it('rejects protocol-relative paths', () => {
    expect(safeReturnPath('//evil.com', SERVER_URL)).toBe('/admin')
  })

  it('rejects backslash tricks', () => {
    expect(safeReturnPath('/\\evil.com', SERVER_URL)).toBe('/admin')
  })

  it('rejects absolute off-origin URLs', () => {
    expect(safeReturnPath('https://evil.com', SERVER_URL)).toBe('/admin')
  })

  it('falls back on an empty string', () => {
    expect(safeReturnPath('', SERVER_URL)).toBe('/admin')
  })

  it('falls back on undefined', () => {
    expect(safeReturnPath(undefined, SERVER_URL)).toBe('/admin')
  })

  it('honors a custom fallback', () => {
    expect(safeReturnPath('//evil.com', SERVER_URL, '/pugs')).toBe('/pugs')
    expect(safeReturnPath(undefined, SERVER_URL, '/pugs')).toBe('/pugs')
  })
})
