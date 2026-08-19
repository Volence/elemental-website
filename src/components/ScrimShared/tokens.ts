/**
 * Shared palette for scrim analytics pages.
 * Single source of truth - the per-page inline hex constants these replace
 * had drifted into four separate copies (ScrimMapDetail, ScrimTeamDetail,
 * ScrimHeroDetail, RangeFilter).
 */
export const SCRIM_COLORS = {
  cyan: '#06b6d4',
  cyanSoft: '#67e8f9',
  green: '#22c55e',
  red: '#ef4444',
  redSoft: '#f87171',
  purple: '#a855f7',
  amber: '#f59e0b',
  bgBase: '#0a0e1a',
  bgCard: '#0f1629',
  bgCardBorder: '#141c35',
  textPrimary: '#e2e8f0',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
} as const

/** Unified range-filter options - one option set for every page. */
export const RANGE_OPTIONS = [
  { value: 'last20', label: 'Last 20 maps' },
  { value: 'last50', label: 'Last 50 maps' },
  { value: 'last30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
] as const

export type RangeValue = (typeof RANGE_OPTIONS)[number]['value']
