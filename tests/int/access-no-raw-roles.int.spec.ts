import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

/**
 * Every permission decision goes through src/access. A raw role string comparison anywhere else
 * is a regression. Allowed: src/access/**, the titles migration mapping, generated payload-types.
 */
const PATTERN = String.raw`role\s*(===|!==|==|!=)\s*['"](admin|staff-manager|team-manager|player|user)['"]|\[['"]admin['"],\s*['"]staff-manager['"]|UserRole\.`
const ALLOW = [/^src\/access\//, /^src\/payload-types\.ts$/, /^src\/migrations\//, /^src\/identity\/merge\.ts$/]

describe('no raw role checks outside src/access', () => {
  // enabled in Task 12
  it.skip('finds none', () => {
    let out = ''
    try {
      out = execSync(`grep -rnE "${PATTERN}" src --include='*.ts' --include='*.tsx' || true`, { encoding: 'utf8' })
    } catch (e: any) { out = e.stdout ?? '' }
    const offenders = out.split('\n').filter(Boolean).filter((line) => !ALLOW.some((re) => re.test(line.split(':')[0])))
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
