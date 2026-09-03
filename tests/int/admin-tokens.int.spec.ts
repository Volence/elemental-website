import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as sass from 'sass'
import { allTokenNames } from '@/admin-kit/tokens'

const stylesDir = resolve(process.cwd(), 'src/app/(payload)/styles')

function compileTokens(): string {
  return sass.compile(resolve(stylesDir, '_tokens-css.scss'), { loadPaths: [stylesDir] }).css
}

describe('admin design tokens', () => {
  it('compiles the CSS custom property partial', () => {
    const css = compileTokens()
    expect(css).toContain(':root')
    expect(css).toMatch(/--elmt-accent-success:\s*(rgb\(34, 197, 94\)|#22c55e)/)
  })

  it('emits every token that tokens.ts references', () => {
    const css = compileTokens()
    const missing = allTokenNames().filter((name) => !css.includes(`--${name}:`))
    expect(missing).toEqual([])
  })

  it('keeps muted and disabled text above the contrast floor', () => {
    // 0.6 and 0.45 white on the admin card background clear 4.5:1. The old
    // 0.5 / 0.3 values were the dominant contrast failure in the audit.
    const vars = readFileSync(resolve(stylesDir, '_variables.scss'), 'utf8')
    expect(vars).toMatch(/\$admin-text-muted:\s*rgba\(255, 255, 255, 0\.6\)/)
    expect(vars).toMatch(/\$admin-text-disabled:\s*rgba\(255, 255, 255, 0\.45\)/)
    expect(vars).toMatch(/\$font-size-2xs:\s*0\.6875rem/)
  })

  it('does not hard-code colours in tokens.ts', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/admin-kit/tokens.ts'), 'utf8')
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/rgba?\(/)
  })
})
