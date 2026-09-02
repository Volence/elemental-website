/**
 * Fuzzy name matching shared by the unlinked-people linker (person -> Discord member)
 * and the first-login claim prompt (Discord member -> person).
 */
export const MATCH_MIN = 0.6
export const MATCH_LIMIT = 3

export function normalizeName(input: string, opts: { stripBattletag?: boolean } = {}): string {
  let s = input ?? ''
  if (opts.stripBattletag) s = s.split('#')[0]
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = i
    for (let j = 1; j <= b.length; j++) {
      const cur = a[i - 1] === b[j - 1] ? prev[j - 1] : Math.min(prev[j - 1], prev[j], last) + 1
      prev[j - 1] = last
      last = cur
    }
    prev[b.length] = last
  }
  return prev[b.length]
}

/** 1.0 exact, 0.8 prefix/containment, otherwise Levenshtein ratio. 0 when either side is empty. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.startsWith(y) || y.startsWith(x) || x.includes(y) || y.includes(x)) return 0.8
  const longer = Math.max(x.length, y.length)
  return (longer - levenshtein(x, y)) / longer
}

export function scoreNames(personNames: Array<string | null | undefined>, discordNames: Array<string | null | undefined>): number {
  let best = 0
  for (const p of personNames) {
    if (!p) continue
    for (const d of discordNames) {
      if (!d) continue
      best = Math.max(best, similarity(p, d))
      if (best === 1) return 1
    }
  }
  return best
}

export function rankCandidates<T>(
  items: T[],
  namesOf: (item: T) => Array<string | null | undefined>,
  discordNames: Array<string | null | undefined>,
  opts: { min?: number; limit?: number } = {},
): Array<{ item: T; score: number }> {
  const min = opts.min ?? MATCH_MIN
  const limit = opts.limit ?? MATCH_LIMIT
  return items
    .map((item) => ({ item, score: scoreNames(namesOf(item), discordNames) }))
    .filter((r) => r.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
