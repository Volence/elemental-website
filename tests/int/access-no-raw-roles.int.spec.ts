import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

/**
 * Every permission decision goes through src/access. A raw role string comparison anywhere else
 * is a regression. Allowed: src/access/**, the titles migration mapping, generated payload-types.
 */
const PATTERN = String.raw`role\s*(===|!==|==|!=)\s*['"](admin|staff-manager|team-manager|player|user)['"]|\[['"]admin['"],\s*['"]staff-manager['"]|UserRole\.`
const ALLOW = [/^src\/access\//, /^src\/payload-types\.ts$/, /^src\/migrations\//, /^src\/identity\/merge\.ts$/]

describe('no raw role checks outside src/access', () => {
  it('finds none', () => {
    let out = ''
    try {
      // execFileSync (no shell) so PATTERN's embedded quote characters can never be
      // misparsed as shell quoting - a shell-string version of this command breaks on
      // /bin/sh (dash) precisely because the pattern contains literal ' and " characters.
      out = execFileSync('grep', ['-rnE', PATTERN, 'src', '--include=*.ts', '--include=*.tsx'], { encoding: 'utf8' })
    } catch (e: any) { out = e.stdout ?? '' }
    const offenders = out.split('\n').filter(Boolean).filter((line) => !ALLOW.some((re) => re.test(line.split(':')[0])))
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
