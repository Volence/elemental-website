/**
 * Admin design tokens for TSX.
 *
 * Each value is a `var(--elmt-*)` reference into the CSS custom properties emitted
 * by `src/app/(payload)/styles/_tokens-css.scss`, which mirrors `_variables.scss`.
 * There are deliberately no hex values here: change a colour in one SCSS file and
 * every consumer follows. Use these only where a class cannot do the job
 * (SVG fills, computed widths); prefer kit components and SCSS otherwise.
 */

const v = (name: string) => `var(--elmt-${name})`

export const color = {
  accent: {
    primary: v('accent-primary'),
    success: v('accent-success'),
    warning: v('accent-warning'),
    error: v('accent-error'),
    info: v('accent-info'),
  },
  tier: {
    masters: v('tier-masters'),
    expert: v('tier-expert'),
    advanced: v('tier-advanced'),
    '4k': v('tier-4k'),
    '35k': v('tier-35k'),
    '30k': v('tier-30k'),
    below: v('tier-below'),
  },
  bg: {
    base: v('bg-base'),
    elevated: v('bg-elevated'),
    surface: v('bg-surface'),
    card: v('bg-card'),
    hover: v('bg-hover'),
  },
  border: {
    subtle: v('border-subtle'),
    default: v('border-default'),
    strong: v('border-strong'),
  },
  text: {
    primary: v('text-primary'),
    secondary: v('text-secondary'),
    muted: v('text-muted'),
    disabled: v('text-disabled'),
  },
} as const

export const space = {
  xs: v('space-xs'),
  sm: v('space-sm'),
  md: v('space-md'),
  lg: v('space-lg'),
  xl: v('space-xl'),
  '2xl': v('space-2xl'),
  '3xl': v('space-3xl'),
} as const

export const font = {
  '2xs': v('font-2xs'),
  xs: v('font-xs'),
  sm: v('font-sm'),
  base: v('font-base'),
  md: v('font-md'),
  lg: v('font-lg'),
  xl: v('font-xl'),
  '2xl': v('font-2xl'),
  '3xl': v('font-3xl'),
} as const

export const radius = {
  xs: v('radius-xs'),
  sm: v('radius-sm'),
  md: v('radius-md'),
  lg: v('radius-lg'),
  xl: v('radius-xl'),
  full: v('radius-full'),
} as const

export const elevation = {
  1: v('elevation-1'),
  2: v('elevation-2'),
  3: v('elevation-3'),
  glow: v('glow-accent'),
} as const

export const container = {
  xs: v('container-xs'),
  sm: v('container-sm'),
  md: v('container-md'),
  lg: v('container-lg'),
  xl: v('container-xl'),
  '2xl': v('container-2xl'),
} as const

export const z = {
  dropdown: v('z-dropdown'),
  sticky: v('z-sticky'),
  modal: v('z-modal'),
  tooltip: v('z-tooltip'),
} as const

/** Every CSS custom property name this module references, for the sync test. */
export function allTokenNames(): string[] {
  const names: string[] = []
  const walk = (obj: Record<string, unknown>) => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        const m = value.match(/^var\(--(elmt-[a-z0-9-]+)\)$/)
        if (m) names.push(m[1])
      } else if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>)
      }
    }
  }
  walk({ color, space, font, radius, elevation, container, z })
  return names
}
